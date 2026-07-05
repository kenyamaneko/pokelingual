import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import type {
  QuestNewResponse,
  ScoreResponse,
  GuessResponse,
  CaptureResponse,
} from "../../../shared/api-types/quest";
import { server, apiUrl, countRequests } from "../test/mswServer";

const refreshUsageMock = vi.fn();
vi.mock("../contexts/UsageContext", () => ({
  useUsage: () => ({ usage: null, refresh: refreshUsageMock }),
}));

import { useQuest } from "./useQuest";

const questResp: QuestNewResponse = {
  pokemon_id: 25,
  description_en: "When several of these Pokemon gather, ...",
  is_legendary: false,
  is_mythical: false,
};

const scoreResp: ScoreResponse = {
  score: 75,
  review: "review",
  description_ja: "ja desc",
};

/**
 * GET /quest/new が指定の出題を返す状態をモックする。
 * @param resp 返す出題レスポンス。
 */
function mockNewQuest(resp: QuestNewResponse = questResp) {
  server.use(http.get(apiUrl("/quest/new"), () => HttpResponse.json(resp)));
}

/**
 * useQuest の仕様:
 * - クエストセッションのライフサイクル (new → score → guess → capture) を state machine として管理する
 * - 全 API 呼び出しで 429 は UsageProvider のモーダルに委譲し、ローカル error は設定しない
 * - 全 API 呼び出しで 5xx (および 401/403/404 等) は error メッセージを保持しつつフェーズは保留
 *
 * フェーズ遷移と副作用 (refreshUsage) の整合性、エラー処理の振り分けを検証する。
 * API 境界は MSW でモックし、UsageContext だけは別コンテキストの境界としてスタブする。
 */
describe("useQuest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("マウント時に /quest/new を呼び、成功で translating フェーズへ遷移する", async () => {
    mockNewQuest();

    const { result } = renderHook(() => useQuest());

    expect(result.current.phase).toBe("loading");

    await waitFor(() => expect(result.current.phase).toBe("translating"));

    expect(result.current.quest).toEqual(questResp);
  });

  it("/quest/new が失敗すると error フェーズに遷移し、メッセージを保持する", async () => {
    server.use(http.get(apiUrl("/quest/new"), () => HttpResponse.json({}, { status: 500 })));

    const { result } = renderHook(() => useQuest());

    await waitFor(() => expect(result.current.phase).toBe("error"));

    expect(result.current.error).not.toBeNull();
  });

  // ステータスごとにユーザー向け文言が切り替わる仕様。表示される文言 (観測結果) で確かめる。
  it.each([
    { status: 401, expected: /認証/ },
    { status: 403, expected: /アクセス権/ },
    { status: 404, expected: /セッションが切断されました/ },
    { status: 502, expected: /外部サービス/ },
  ])("/quest/new の $status ではステータスに応じた文言を表示する", async ({ status, expected }) => {
    server.use(http.get(apiUrl("/quest/new"), () => HttpResponse.json({}, { status })));

    const { result } = renderHook(() => useQuest());
    await waitFor(() => expect(result.current.phase).toBe("error"));

    expect(result.current.error).toMatch(expected);
  });

  it("ネットワーク断 (レスポンス無し) では接続エラーの文言を表示する", async () => {
    server.use(http.get(apiUrl("/quest/new"), () => HttpResponse.error()));

    const { result } = renderHook(() => useQuest());
    await waitFor(() => expect(result.current.phase).toBe("error"));

    expect(result.current.error).toMatch(/接続できません/);
  });

  it("submitTranslation 成功で guessing フェーズへ遷移し、usage 再取得が走る", async () => {
    mockNewQuest();
    server.use(http.post(apiUrl("/quest/score"), () => HttpResponse.json(scoreResp)));

    const { result } = renderHook(() => useQuest());
    await waitFor(() => expect(result.current.phase).toBe("translating"));

    await act(async () => {
      await result.current.submitTranslation("テスト翻訳");
    });

    expect(result.current.phase).toBe("guessing");
    expect(result.current.score).toEqual(scoreResp);
    expect(result.current.userTranslation).toBe("テスト翻訳");
    expect(refreshUsageMock).toHaveBeenCalled();
  });

  // submitTranslation / submitGuess / capture すべてのフェーズで「429 は UsageProvider に委譲、
  // 5xx はローカル error 文言として保持」する仕様。3 API 分まとめて検証する。
  it.each([
    {
      api: "submitTranslation",
      path: "/quest/score",
      call: (r: ReturnType<typeof useQuest>) => r.submitTranslation("yaku"),
    },
    {
      api: "submitGuess",
      path: "/quest/guess-name",
      call: (r: ReturnType<typeof useQuest>) => r.submitGuess("Pikachu"),
    },
    {
      api: "capture",
      path: "/quest/capture",
      call: (r: ReturnType<typeof useQuest>) => r.capture(),
    },
  ])("$api の 429 では error 文言を出さず、フェーズも変えない (UsageProvider に委譲)", async ({
    path,
    call,
  }) => {
    mockNewQuest();
    server.use(
      http.post(apiUrl(path), () =>
        HttpResponse.json({ error: "user", message: "x" }, { status: 429 }),
      ),
    );

    const { result } = renderHook(() => useQuest());
    await waitFor(() => expect(result.current.phase).toBe("translating"));

    await act(async () => {
      await call(result.current);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.phase).toBe("translating");
  });

  it.each([
    {
      api: "submitTranslation",
      path: "/quest/score",
      call: (r: ReturnType<typeof useQuest>) => r.submitTranslation("yaku"),
    },
    {
      api: "submitGuess",
      path: "/quest/guess-name",
      call: (r: ReturnType<typeof useQuest>) => r.submitGuess("Pikachu"),
    },
    {
      api: "capture",
      path: "/quest/capture",
      call: (r: ReturnType<typeof useQuest>) => r.capture(),
    },
  ])("$api の 5xx エラーでは error メッセージを保持しつつフェーズは保留", async ({
    path,
    call,
  }) => {
    mockNewQuest();
    server.use(http.post(apiUrl(path), () => HttpResponse.json({}, { status: 502 })));

    const { result } = renderHook(() => useQuest());
    await waitFor(() => expect(result.current.phase).toBe("translating"));

    await act(async () => {
      await call(result.current);
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.phase).toBe("translating");
  });

  it("submitGuess で ball_type が返れば ballType に保存する", async () => {
    mockNewQuest();
    const guess: GuessResponse = {
      correct: true,
      ball_type: "ultra",
      language: "en",
      attempts_remaining: 2,
    };
    server.use(http.post(apiUrl("/quest/guess-name"), () => HttpResponse.json(guess)));

    const { result } = renderHook(() => useQuest());
    await waitFor(() => expect(result.current.phase).toBe("translating"));

    await act(async () => {
      await result.current.submitGuess("Pikachu");
    });

    expect(result.current.guessResult).toEqual(guess);
    expect(result.current.ballType).toBe("ultra");
  });

  it("skipGuess はサーバに明示し ballType=poke にして capturing フェーズへ遷移する", async () => {
    mockNewQuest();
    server.use(
      http.post(apiUrl("/quest/skip-guess"), () => HttpResponse.json({ ball_type: "poke" })),
    );

    const { result } = renderHook(() => useQuest());
    await waitFor(() => expect(result.current.phase).toBe("translating"));

    await act(async () => {
      await result.current.skipGuess();
    });

    // スキップはクライアント内で完結せず、サーバの /quest/skip-guess を叩く
    expect(countRequests("/quest/skip-guess")).toBe(1);
    expect(result.current.ballType).toBe("poke");
    expect(result.current.phase).toBe("capturing");
  });

  it("capture 成功で result フェーズに遷移し captureResult を保持する", async () => {
    mockNewQuest();
    const captured: CaptureResponse = {
      captured: true,
      probability: 0.9,
      pokemon_id: 25,
      name_en: "Pikachu",
      name_ja: "ピカチュウ",
      sprite_url: "https://example.com/p.png",
      score: 90,
      description_en: "x",
      description_ja: "y",
      base_stat_total: 320,
      ball_type: "ultra",
      types: ["electric"],
      height: 4,
      weight: 60,
      is_legendary: false,
      is_mythical: false,
    };
    server.use(http.post(apiUrl("/quest/capture"), () => HttpResponse.json(captured)));

    const { result } = renderHook(() => useQuest());
    await waitFor(() => expect(result.current.phase).toBe("translating"));

    await act(async () => {
      await result.current.capture();
    });

    expect(result.current.phase).toBe("result");
    expect(result.current.captureResult).toEqual(captured);
  });

  it("startNewQuest で全 state がリセットされ、loading→translating になる", async () => {
    mockNewQuest();
    server.use(http.post(apiUrl("/quest/score"), () => HttpResponse.json(scoreResp)));

    const { result } = renderHook(() => useQuest());
    await waitFor(() => expect(result.current.phase).toBe("translating"));

    // 進捗を進めて state を持たせた状態を作る
    await act(async () => {
      await result.current.submitTranslation("テスト");
    });
    expect(result.current.phase).toBe("guessing");

    // 新しいクエストを開始すると state がリセットされる
    const second: QuestNewResponse = { ...questResp, pokemon_id: 1 };
    mockNewQuest(second);

    await act(async () => {
      await result.current.startNewQuest();
    });

    expect(result.current.phase).toBe("translating");
    expect(result.current.score).toBeNull();
    expect(result.current.userTranslation).toBe("");
    expect(result.current.ballType).toBeNull();
    expect(result.current.quest).toEqual(second);
  });
});
