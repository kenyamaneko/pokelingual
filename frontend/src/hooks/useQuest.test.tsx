import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import type { User } from "firebase/auth";
import type {
  QuestNewResponse,
  ScoreResponse,
  GuessResponse,
  CaptureResponse,
} from "../../../shared/api-types/quest";
import { server, apiUrl, countRequests } from "../test/mswServer";
import { AuthContext } from "../contexts/AuthContext";
import { UsageProvider } from "../contexts/UsageContext";
import { useQuest } from "./useQuest";

const fakeUser = { uid: "trainer-test" } as unknown as User;

/** AuthContext + UsageProvider を被せる renderHook 用ラッパー。useQuest が依存する UsageContext を本物のまま通す。 */
function Wrapper({ children }: { children: ReactNode }) {
  const auth = {
    user: fakeUser,
    loading: false,
    login: async () => {},
    signup: async () => {},
    loginWithGoogle: async () => {},
    resetPassword: async () => {},
    logout: async () => {},
  };
  return (
    <AuthContext.Provider value={auth}>
      <UsageProvider>{children}</UsageProvider>
    </AuthContext.Provider>
  );
}

const questResp: QuestNewResponse = {
  pokemon_id: 25,
  description_en: "A wild creature.",
  is_legendary: false,
  is_mythical: false,
  max_guess_attempts: 3,
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
 * useQuest をマウントし、最初の場所を選んで出題を開始した状態にする。
 * @returns renderHook の戻り値。
 */
async function mountAndSelectLocation() {
  const hook = renderHook(() => useQuest(), { wrapper: Wrapper });
  await waitFor(() => expect(hook.result.current.locations.length).toBeGreaterThan(0));
  await act(async () => {
    await hook.result.current.selectLocation(hook.result.current.locations[0].id);
  });
  return hook;
}

/**
 * useQuest の仕様:
 * - クエストセッションのライフサイクル (new → score → guess → capture) を state machine として管理する
 * - 全 API 呼び出しで 429 は UsageProvider のモーダルに委譲し、ローカル error は設定しない
 * - 全 API 呼び出しで 5xx (および 401/403/404 等) は error メッセージを保持しつつフェーズは保留
 *
 * フェーズ遷移とエラー処理の振り分けを検証する。採点成功時の refreshUsage 副作用
 * (残量表示の同期) は scoreUsageSync.test.tsx が別ファイルで確かめる。
 * API 境界は MSW でモックし、UsageContext は AuthContext 同様に本物の Provider を通す。
 */
describe("[クエスト] クエスト進行", () => {
  it("マウント時に場所選択が表示され、場所を選ぶと訳文入力の段階へ遷移する", async () => {
    mockNewQuest();

    const { result } = renderHook(() => useQuest(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.phase).toBe("selectLocation"));
    await waitFor(() => expect(result.current.locations.length).toBeGreaterThan(0));

    await act(async () => {
      await result.current.selectLocation(result.current.locations[0].id);
    });

    expect(result.current.phase).toBe("translating");
    expect(result.current.quest).toEqual(questResp);
  });

  it("場所の取得に失敗すると、エラー画面に遷移してメッセージを保持する", async () => {
    server.use(http.get(apiUrl("/quest/locations"), () => HttpResponse.json({}, { status: 500 })));

    const { result } = renderHook(() => useQuest(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.phase).toBe("error"));

    expect(result.current.error).not.toBeNull();
  });

  it("場所を選んだ後の出題取得に失敗すると、エラー画面に遷移してメッセージを保持する", async () => {
    server.use(http.get(apiUrl("/quest/new"), () => HttpResponse.json({}, { status: 500 })));

    const { result } = await mountAndSelectLocation();
    await waitFor(() => expect(result.current.phase).toBe("error"));

    expect(result.current.error).not.toBeNull();
  });

  // ステータスごとにユーザー向け文言が切り替わる仕様。表示される文言 (観測結果) で確かめる。
  it.each([
    { status: 401, expected: /認証/ },
    { status: 403, expected: /アクセス権/ },
    { status: 404, expected: /セッションが切断されました/ },
    { status: 502, expected: /外部サービス/ },
  ])("出題取得が $status のとき、ステータスに応じた文言を表示する", async ({ status, expected }) => {
    server.use(http.get(apiUrl("/quest/new"), () => HttpResponse.json({}, { status })));

    const { result } = await mountAndSelectLocation();
    await waitFor(() => expect(result.current.phase).toBe("error"));

    expect(result.current.error).toMatch(expected);
  });

  it("ネットワーク断 (レスポンス無し) では接続エラーの文言を表示する", async () => {
    server.use(http.get(apiUrl("/quest/new"), () => HttpResponse.error()));

    const { result } = await mountAndSelectLocation();
    await waitFor(() => expect(result.current.phase).toBe("error"));

    expect(result.current.error).toMatch(/接続できません/);
  });

  it("採点が成功すると名前当てに進み、得点と翻訳内容を保持する", async () => {
    mockNewQuest();
    server.use(http.post(apiUrl("/quest/score"), () => HttpResponse.json(scoreResp)));

    const { result } = await mountAndSelectLocation();
    await waitFor(() => expect(result.current.phase).toBe("translating"));

    await act(async () => {
      await result.current.submitTranslation("テスト翻訳");
    });

    expect(result.current.phase).toBe("guessing");
    expect(result.current.score).toEqual(scoreResp);
    expect(result.current.userTranslation).toBe("テスト翻訳");
  });

  // submitTranslation / submitGuess / capture すべてのフェーズで「429 は UsageProvider に委譲、
  // 5xx はローカル error 文言として保持」する仕様。3 API 分まとめて検証する。
  it.each([
    ["採点", "/quest/score", (r: ReturnType<typeof useQuest>) => r.submitTranslation("yaku")],
    ["名前推測", "/quest/guess-name", (r: ReturnType<typeof useQuest>) => r.submitGuess("Testmon")],
    ["ヒント要求", "/quest/hint", (r: ReturnType<typeof useQuest>) => r.requestHint()],
    ["捕獲", "/quest/capture", (r: ReturnType<typeof useQuest>) => r.capture()],
  ] as const)("%sで 429 が返っても、エラー文言を出さずフェーズも変えない (上限は利用上限モーダルに委譲)", async (
    _api,
    path,
    call,
  ) => {
    mockNewQuest();
    server.use(
      http.post(apiUrl(path), () =>
        HttpResponse.json({ error: "user", message: "x" }, { status: 429 }),
      ),
    );

    const { result } = await mountAndSelectLocation();
    await waitFor(() => expect(result.current.phase).toBe("translating"));

    await act(async () => {
      await call(result.current);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.phase).toBe("translating");
  });

  it.each([
    ["採点", "/quest/score", (r: ReturnType<typeof useQuest>) => r.submitTranslation("yaku")],
    ["名前推測", "/quest/guess-name", (r: ReturnType<typeof useQuest>) => r.submitGuess("Testmon")],
    ["ヒント要求", "/quest/hint", (r: ReturnType<typeof useQuest>) => r.requestHint()],
    ["捕獲", "/quest/capture", (r: ReturnType<typeof useQuest>) => r.capture()],
  ] as const)("%sで 5xx が返っても、エラーメッセージを保持しフェーズは変えない", async (
    _api,
    path,
    call,
  ) => {
    mockNewQuest();
    server.use(http.post(apiUrl(path), () => HttpResponse.json({}, { status: 502 })));

    const { result } = await mountAndSelectLocation();
    await waitFor(() => expect(result.current.phase).toBe("translating"));

    await act(async () => {
      await call(result.current);
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.phase).toBe("translating");
  });

  it.each([
    ["採点", "/quest/score", (r: ReturnType<typeof useQuest>) => r.submitTranslation("yaku")],
    ["名前推測", "/quest/guess-name", (r: ReturnType<typeof useQuest>) => r.submitGuess("Testmon")],
    ["ヒント要求", "/quest/hint", (r: ReturnType<typeof useQuest>) => r.requestHint()],
    ["捕獲", "/quest/capture", (r: ReturnType<typeof useQuest>) => r.capture()],
  ] as const)("%sで 404 (セッション切断) になると、エラー画面へ切り替わり切断を案内する", async (
    _api,
    path,
    call,
  ) => {
    mockNewQuest();
    server.use(http.post(apiUrl(path), () => HttpResponse.json({}, { status: 404 })));

    const { result } = await mountAndSelectLocation();
    await waitFor(() => expect(result.current.phase).toBe("translating"));

    await act(async () => {
      await call(result.current);
    });

    expect(result.current.phase).toBe("error");
    expect(result.current.error).toMatch(/セッションが切断されました/);
  });

  it("名前当てが成立してボールの種類が返ると、その種類を保持する", async () => {
    mockNewQuest();
    const guess: GuessResponse = {
      correct: true,
      ball_type: "ultra",
      language: "en",
      attempts_remaining: 2,
    };
    server.use(http.post(apiUrl("/quest/guess-name"), () => HttpResponse.json(guess)));

    const { result } = await mountAndSelectLocation();
    await waitFor(() => expect(result.current.phase).toBe("translating"));

    await act(async () => {
      await result.current.submitGuess("Testmon");
    });

    expect(result.current.guessResult).toEqual(guess);
    expect(result.current.ballType).toBe("ultra");
  });

  it("ヒントを要求すると、タイプと残り試行回数を保持する", async () => {
    mockNewQuest();
    server.use(
      http.post(apiUrl("/quest/hint"), () =>
        HttpResponse.json({ types: ["electric"], attempts_remaining: 2 }),
      ),
    );

    const { result } = await mountAndSelectLocation();
    await waitFor(() => expect(result.current.phase).toBe("translating"));

    await act(async () => {
      await result.current.requestHint();
    });

    expect(result.current.hintResult).toEqual({ types: ["electric"], attempts_remaining: 2 });
    expect(result.current.attemptsRemaining).toBe(2);
  });

  it("1回目のヒントでタイプ、2回目のヒントで技を取得すると、hintResultはタイプと技の両方を含む", async () => {
    mockNewQuest();
    server.use(
      http.post(apiUrl("/quest/hint"), () =>
        HttpResponse.json({ types: ["electric"], attempts_remaining: 2 }),
      ),
    );

    const { result } = await mountAndSelectLocation();
    await waitFor(() => expect(result.current.phase).toBe("translating"));

    await act(async () => {
      await result.current.requestHint();
    });

    server.use(
      http.post(apiUrl("/quest/hint"), () =>
        HttpResponse.json({
          moves: ["たいあたり", "なきごえ", "でんきショック"],
          attempts_remaining: 1,
        }),
      ),
    );

    await act(async () => {
      await result.current.requestHint();
    });

    expect(result.current.hintResult).toEqual({
      types: ["electric"],
      moves: ["たいあたり", "なきごえ", "でんきショック"],
      attempts_remaining: 1,
    });
    expect(result.current.attemptsRemaining).toBe(1);
  });

  it("名前当て確定後に捕獲の段階へ進んでも、スキップの通信は発生しない", async () => {
    mockNewQuest();
    const guess: GuessResponse = {
      correct: true,
      ball_type: "ultra",
      language: "en",
      attempts_remaining: 2,
    };
    server.use(http.post(apiUrl("/quest/guess-name"), () => HttpResponse.json(guess)));

    const { result } = await mountAndSelectLocation();
    await waitFor(() => expect(result.current.phase).toBe("translating"));

    await act(async () => {
      await result.current.submitGuess("Testmon");
    });

    act(() => {
      result.current.proceedToCapture();
    });

    expect(countRequests("/quest/skip-guess")).toBe(0);
    expect(result.current.phase).toBe("capturing");
  });

  it("名前当てをスキップすると、サーバに明示的に伝えてモンスターボールに確定し、捕獲の段階へ遷移する", async () => {
    mockNewQuest();
    server.use(
      http.post(apiUrl("/quest/skip-guess"), () => HttpResponse.json({ ball_type: "poke" })),
    );

    const { result } = await mountAndSelectLocation();
    await waitFor(() => expect(result.current.phase).toBe("translating"));

    await act(async () => {
      await result.current.skipGuess();
    });

    // スキップはクライアント内で完結せず、サーバの /quest/skip-guess を叩く
    expect(countRequests("/quest/skip-guess")).toBe(1);
    expect(result.current.ballType).toBe("poke");
    expect(result.current.phase).toBe("capturing");
  });

  it("捕獲すると捕獲演出に進み、捕獲結果が保持される", async () => {
    mockNewQuest();
    const captured: CaptureResponse = {
      captured: true,
      probability: 0.9,
      pokemon_id: 9001,
      name_en: "Testmon",
      name_ja: "テストモン",
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

    const { result } = await mountAndSelectLocation();
    await waitFor(() => expect(result.current.phase).toBe("translating"));

    await act(async () => {
      await result.current.capture();
    });

    expect(result.current.phase).toBe("revealing");
    expect(result.current.captureResult).toEqual(captured);
  });

  it("捕獲演出が終わると、結果表示の段階へ進み捕獲結果を維持する", async () => {
    mockNewQuest();
    const captured: CaptureResponse = {
      captured: false,
      probability: 0.2,
      pokemon_id: 9001,
      name_en: "Testmon",
      name_ja: "テストモン",
      sprite_url: "https://example.com/p.png",
      score: 40,
      description_en: "x",
      description_ja: "y",
      base_stat_total: 250,
      ball_type: "poke",
      types: ["normal"],
      height: 4,
      weight: 60,
      is_legendary: false,
      is_mythical: false,
    };
    server.use(http.post(apiUrl("/quest/capture"), () => HttpResponse.json(captured)));

    const { result } = await mountAndSelectLocation();
    await waitFor(() => expect(result.current.phase).toBe("translating"));

    await act(async () => {
      await result.current.capture();
    });
    expect(result.current.phase).toBe("revealing");

    act(() => {
      result.current.revealCaptureResult();
    });

    expect(result.current.phase).toBe("result");
    expect(result.current.captureResult).toEqual(captured);
  });

  it("新しいクエストを開始すると状態がリセットされ場所選択に戻り、選び直すと新しい出題になる", async () => {
    mockNewQuest();
    server.use(http.post(apiUrl("/quest/score"), () => HttpResponse.json(scoreResp)));

    const { result } = await mountAndSelectLocation();
    await waitFor(() => expect(result.current.phase).toBe("translating"));

    // 進捗を進めて state を持たせた状態を作る
    await act(async () => {
      await result.current.submitTranslation("テスト");
    });
    expect(result.current.phase).toBe("guessing");

    await act(async () => {
      await result.current.requestHint();
    });
    expect(result.current.hintResult).not.toBeNull();

    const second: QuestNewResponse = { ...questResp, pokemon_id: 1 };
    mockNewQuest(second);

    await act(async () => {
      await result.current.startNewQuest();
    });

    expect(result.current.phase).toBe("selectLocation");
    expect(result.current.score).toBeNull();
    expect(result.current.userTranslation).toBe("");
    expect(result.current.ballType).toBeNull();
    expect(result.current.attemptsRemaining).toBeNull();
    expect(result.current.hintResult).toBeNull();

    await waitFor(() => expect(result.current.locations.length).toBeGreaterThan(0));
    await act(async () => {
      await result.current.selectLocation(result.current.locations[0].id);
    });
    expect(result.current.phase).toBe("translating");
    expect(result.current.quest).toEqual(second);
  });
});
