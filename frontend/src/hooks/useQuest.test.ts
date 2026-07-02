import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AxiosError, type AxiosResponse } from "axios";
import type {
  QuestNewResponse,
  ScoreResponse,
  GuessResponse,
  CaptureResponse,
} from "../../../shared/api-types/quest";

vi.mock("../api/questApi", () => ({
  questApi: {
    newQuest: vi.fn(),
    scoreTranslation: vi.fn(),
    guessName: vi.fn(),
    skipGuess: vi.fn(),
    attemptCapture: vi.fn(),
    replyToChat: vi.fn(),
  },
}));

const refreshUsageMock = vi.fn();
vi.mock("../contexts/UsageContext", () => ({
  useUsage: () => ({ usage: null, refresh: refreshUsageMock }),
}));

import { useQuest } from "./useQuest";
import { questApi } from "../api/questApi";

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

function axiosOk<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: "OK",
    headers: {},
    // テスト用のダミー config。実装で参照されないため最小構成。
    config: { headers: {} } as AxiosResponse<T>["config"],
  };
}

function makeAxiosError(status: number): AxiosError {
  return new AxiosError(
    "test error",
    AxiosError.ERR_BAD_RESPONSE,
    undefined,
    undefined,
    {
      data: {},
      status,
      statusText: "",
      headers: {},
      config: { headers: {} } as AxiosResponse["config"],
    },
  );
}

/**
 * useQuest の仕様:
 * - クエストセッションのライフサイクル (new → score → guess → capture) を state machine として管理する
 * - 全 API 呼び出しで 429 は UsageProvider のモーダルに委譲し、ローカル error は設定しない
 * - 全 API 呼び出しで 5xx (および 401/403/404 等) は error メッセージを保持しつつフェーズは保留
 *
 * フェーズ遷移と副作用 (refreshUsage) の整合性、エラー処理の振り分けを検証する。
 */
describe("useQuest の仕様", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("マウント時に /quest/new を呼び、成功で translating フェーズへ遷移する", async () => {
    vi.mocked(questApi.newQuest).mockResolvedValue(axiosOk(questResp));

    const { result } = renderHook(() => useQuest());

    expect(result.current.phase).toBe("loading");

    await waitFor(() => expect(result.current.phase).toBe("translating"));

    expect(result.current.quest).toEqual(questResp);
    expect(questApi.newQuest).toHaveBeenCalledOnce();
  });

  it("/quest/new が失敗すると error フェーズに遷移し、メッセージを保持する", async () => {
    vi.mocked(questApi.newQuest).mockRejectedValue(makeAxiosError(500));

    const { result } = renderHook(() => useQuest());

    await waitFor(() => expect(result.current.phase).toBe("error"));

    expect(result.current.error).not.toBeNull();
  });

  it("submitTranslation 成功で guessing フェーズへ遷移し、usage 再取得が走る", async () => {
    vi.mocked(questApi.newQuest).mockResolvedValue(axiosOk(questResp));
    vi.mocked(questApi.scoreTranslation).mockResolvedValue(axiosOk(scoreResp));

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
      mock: () =>
        vi.mocked(questApi.scoreTranslation).mockRejectedValue(makeAxiosError(429)),
      call: (r: ReturnType<typeof useQuest>) => r.submitTranslation("yaku"),
      expectedPhase: "translating",
    },
    {
      api: "submitGuess",
      mock: () =>
        vi.mocked(questApi.guessName).mockRejectedValue(makeAxiosError(429)),
      call: (r: ReturnType<typeof useQuest>) => r.submitGuess("Pikachu"),
      expectedPhase: "translating",
    },
    {
      api: "capture",
      mock: () =>
        vi.mocked(questApi.attemptCapture).mockRejectedValue(makeAxiosError(429)),
      call: (r: ReturnType<typeof useQuest>) => r.capture(),
      expectedPhase: "translating",
    },
  ])("$api の 429 では error 文言を出さず、フェーズも変えない (UsageProvider に委譲)", async ({
    mock,
    call,
    expectedPhase,
  }) => {
    vi.mocked(questApi.newQuest).mockResolvedValue(axiosOk(questResp));
    mock();

    const { result } = renderHook(() => useQuest());
    await waitFor(() => expect(result.current.phase).toBe("translating"));

    await act(async () => {
      await call(result.current);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.phase).toBe(expectedPhase);
  });

  it.each([
    {
      api: "submitTranslation",
      mock: () =>
        vi.mocked(questApi.scoreTranslation).mockRejectedValue(makeAxiosError(502)),
      call: (r: ReturnType<typeof useQuest>) => r.submitTranslation("yaku"),
    },
    {
      api: "submitGuess",
      mock: () =>
        vi.mocked(questApi.guessName).mockRejectedValue(makeAxiosError(502)),
      call: (r: ReturnType<typeof useQuest>) => r.submitGuess("Pikachu"),
    },
    {
      api: "capture",
      mock: () =>
        vi.mocked(questApi.attemptCapture).mockRejectedValue(makeAxiosError(502)),
      call: (r: ReturnType<typeof useQuest>) => r.capture(),
    },
  ])("$api の 5xx エラーでは error メッセージを保持しつつフェーズは保留", async ({
    mock,
    call,
  }) => {
    vi.mocked(questApi.newQuest).mockResolvedValue(axiosOk(questResp));
    mock();

    const { result } = renderHook(() => useQuest());
    await waitFor(() => expect(result.current.phase).toBe("translating"));

    await act(async () => {
      await call(result.current);
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.phase).toBe("translating");
  });

  it("submitGuess で ball_type が返れば ballType に保存する", async () => {
    vi.mocked(questApi.newQuest).mockResolvedValue(axiosOk(questResp));
    const guess: GuessResponse = {
      correct: true,
      ball_type: "ultra",
      language: "en",
      attempts_remaining: 2,
    };
    vi.mocked(questApi.guessName).mockResolvedValue(axiosOk(guess));

    const { result } = renderHook(() => useQuest());
    await waitFor(() => expect(result.current.phase).toBe("translating"));

    await act(async () => {
      await result.current.submitGuess("Pikachu");
    });

    expect(result.current.guessResult).toEqual(guess);
    expect(result.current.ballType).toBe("ultra");
  });

  it("skipGuess はサーバに明示し ballType=poke にして capturing フェーズへ遷移する", async () => {
    vi.mocked(questApi.newQuest).mockResolvedValue(axiosOk(questResp));
    vi.mocked(questApi.skipGuess).mockResolvedValue(axiosOk({ ball_type: "poke" }));

    const { result } = renderHook(() => useQuest());
    await waitFor(() => expect(result.current.phase).toBe("translating"));

    await act(async () => {
      await result.current.skipGuess();
    });

    expect(questApi.skipGuess).toHaveBeenCalledOnce();
    expect(result.current.ballType).toBe("poke");
    expect(result.current.phase).toBe("capturing");
  });

  it("capture 成功で result フェーズに遷移し captureResult を保持する", async () => {
    vi.mocked(questApi.newQuest).mockResolvedValue(axiosOk(questResp));
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
    vi.mocked(questApi.attemptCapture).mockResolvedValue(axiosOk(captured));

    const { result } = renderHook(() => useQuest());
    await waitFor(() => expect(result.current.phase).toBe("translating"));

    await act(async () => {
      await result.current.capture();
    });

    expect(result.current.phase).toBe("result");
    expect(result.current.captureResult).toEqual(captured);
  });

  it("startNewQuest で全 state がリセットされ、loading→translating になる", async () => {
    vi.mocked(questApi.newQuest).mockResolvedValue(axiosOk(questResp));
    vi.mocked(questApi.scoreTranslation).mockResolvedValue(axiosOk(scoreResp));

    const { result } = renderHook(() => useQuest());
    await waitFor(() => expect(result.current.phase).toBe("translating"));

    // 進捗を進めて state を持たせた状態を作る
    await act(async () => {
      await result.current.submitTranslation("テスト");
    });
    expect(result.current.phase).toBe("guessing");

    // 新しいクエストを開始すると state がリセットされる
    const second: QuestNewResponse = { ...questResp, pokemon_id: 1 };
    vi.mocked(questApi.newQuest).mockResolvedValue(axiosOk(second));

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
