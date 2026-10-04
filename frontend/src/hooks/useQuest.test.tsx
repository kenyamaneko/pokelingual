import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
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

const captureResp: CaptureResponse = {
  captured: true,
  probability: 0.9,
  pokemon_id: 25,
  name_en: "Pikachu",
  name_ja: "ピカチュウ",
  sprite_url: "https://example.com/pikachu.png",
  score: 75,
  description_en: "desc en",
  description_ja: "desc ja",
  base_stat_total: 320,
  ball_type: "ultra",
  types: ["electric"],
  height: 4,
  weight: 60,
  is_legendary: false,
  is_mythical: false,
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
 * 出題を得て訳文入力の段階になるまで進めた useQuest をマウントする。
 * @returns renderHook の戻り値。
 */
async function mountInTranslating() {
  mockNewQuest();
  const hook = await mountAndSelectLocation();
  await waitFor(() => expect(hook.result.current.phase).toBe("translating"));
  return hook;
}

type QuestHook = ReturnType<typeof useQuest>;

const guessCorrect: GuessResponse = {
  correct: true,
  ball_type: "ultra",
  language: "en",
  attempts_remaining: 2,
};

const captureFailed: CaptureResponse = {
  captured: false,
  probability: 0.2,
  pokemon_id: 25,
  name_en: "Pikachu",
  name_ja: "ピカチュウ",
  sprite_url: "https://example.com/p.png",
  score: 40,
  description_en: "x",
  description_ja: "y",
  base_stat_total: 320,
  ball_type: "poke",
  types: ["electric"],
  height: 4,
  weight: 60,
  is_legendary: false,
  is_mythical: false,
};

const operations = [
  {
    operation: "訳文を送信する",
    path: "/quest/score",
    call: (r: QuestHook) => r.submitTranslation("yaku"),
    buildSuccess: () => HttpResponse.json(scoreResp),
  },
  {
    operation: "名前を送信する",
    path: "/quest/guess-name",
    call: (r: QuestHook) => r.submitGuess("Pikachu"),
    buildSuccess: () => HttpResponse.json({ correct: false, attempts_remaining: 2 }),
  },
  {
    operation: "ヒントを要求する",
    path: "/quest/hint",
    call: (r: QuestHook) => r.requestHint(),
    buildSuccess: () => HttpResponse.json({ types: ["electric"], attempts_remaining: 2 }),
  },
  {
    operation: "捕獲を実行する",
    path: "/quest/capture",
    call: (r: QuestHook) => r.capture(),
    buildSuccess: () => HttpResponse.json(captureResp),
  },
];

const operationRows = operations.map((op) => [op.operation, op] as const);

/**
 * 採点・名前当ての正解・ヒントの要求まで進めたあと、新しいクエストを開始する。
 * @returns renderHook の戻り値。
 */
async function startNewQuestAfterProgress() {
  server.use(
    http.post(apiUrl("/quest/score"), () => HttpResponse.json(scoreResp)),
    http.post(apiUrl("/quest/guess-name"), () => HttpResponse.json(guessCorrect)),
  );
  const hook = await mountInTranslating();
  await act(async () => {
    await hook.result.current.submitTranslation("テスト");
  });
  await act(async () => {
    await hook.result.current.submitGuess("Pikachu");
  });
  await act(async () => {
    await hook.result.current.requestHint();
  });
  mockNewQuest({ ...questResp, pokemon_id: 1 });
  await act(async () => {
    await hook.result.current.startNewQuest();
  });
  return hook;
}

describe("[クエスト] 場所選択と出題の開始", () => {
  describe("正常系", () => {
    describe("場所選択の段階で場所を選んだとき", () => {
      it("訳文入力の段階になる", async () => {
        mockNewQuest();

        const { result } = await mountAndSelectLocation();

        await waitFor(() => expect(result.current.phase).toBe("translating"));
      });

      it("バックエンドが返した出題の内容が得られる", async () => {
        mockNewQuest();

        const { result } = await mountAndSelectLocation();

        await waitFor(() => expect(result.current.quest).toEqual(questResp));
      });
    });
  });

  describe("異常系", () => {
    describe("場所の一覧の取得が 500 で失敗したとき", () => {
      const mockLocationsFailure = () =>
        server.use(http.get(apiUrl("/quest/locations"), () => HttpResponse.json({}, { status: 500 })));

      it("エラー画面になる", async () => {
        mockLocationsFailure();

        const { result } = renderHook(() => useQuest(), { wrapper: Wrapper });

        await waitFor(() => expect(result.current.phase).toBe("error"));
      });

      it("エラーメッセージに「場所の読み込みに失敗しました」が含まれる", async () => {
        mockLocationsFailure();

        const { result } = renderHook(() => useQuest(), { wrapper: Wrapper });
        await waitFor(() => expect(result.current.phase).toBe("error"));

        expect(result.current.error).toContain("場所の読み込みに失敗しました");
      });
    });

    describe("場所を選んだ後の出題の取得が 500 で失敗したとき", () => {
      const mockNewQuestFailure = () =>
        server.use(http.get(apiUrl("/quest/new"), () => HttpResponse.json({}, { status: 500 })));

      it("エラー画面になる", async () => {
        mockNewQuestFailure();

        const { result } = await mountAndSelectLocation();

        await waitFor(() => expect(result.current.phase).toBe("error"));
      });

      it("エラーメッセージに「データの読み込みに失敗しました」が含まれる", async () => {
        mockNewQuestFailure();

        const { result } = await mountAndSelectLocation();
        await waitFor(() => expect(result.current.phase).toBe("error"));

        expect(result.current.error).toContain("データの読み込みに失敗しました");
      });
    });

    describe("場所を選んだ後の出題の取得が失敗したとき", () => {
      it.each([
        [401, "認証に失敗しました"],
        [403, "アクセス権がありません"],
        [404, "セッションが切断されました"],
        [502, "外部サービスが応答しません"],
      ])("ステータスが %i のとき、エラーメッセージに「%s」が含まれる", async (status, message) => {
        server.use(http.get(apiUrl("/quest/new"), () => HttpResponse.json({}, { status })));

        const { result } = await mountAndSelectLocation();
        await waitFor(() => expect(result.current.phase).toBe("error"));

        expect(result.current.error).toContain(message);
      });

      it("ネットワークが切れていて応答が無いとき、エラーメッセージに「サーバーに接続できません」が含まれる", async () => {
        server.use(http.get(apiUrl("/quest/new"), () => HttpResponse.error()));

        const { result } = await mountAndSelectLocation();
        await waitFor(() => expect(result.current.phase).toBe("error"));

        expect(result.current.error).toContain("サーバーに接続できません");
      });
    });
  });
});

describe("[クエスト] 訳文の採点", () => {
  describe("正常系", () => {
    describe("訳文入力の段階で訳文を送信し、採点に成功したとき", () => {
      async function submitTranslationSuccessfully() {
        server.use(http.post(apiUrl("/quest/score"), () => HttpResponse.json(scoreResp)));
        const { result } = await mountInTranslating();
        await act(async () => {
          await result.current.submitTranslation("テスト翻訳");
        });
        return result;
      }

      it("名前当ての段階になる", async () => {
        const result = await submitTranslationSuccessfully();

        expect(result.current.phase).toBe("guessing");
      });

      it("バックエンドが返した採点結果が得られる", async () => {
        const result = await submitTranslationSuccessfully();

        expect(result.current.score).toEqual(scoreResp);
      });

      it("送信した訳文が得られる", async () => {
        const result = await submitTranslationSuccessfully();

        expect(result.current.userTranslation).toBe("テスト翻訳");
      });
    });
  });
});

describe("[クエスト] 名前当ての回答", () => {
  describe("正常系", () => {
    describe("名前を送信し、バックエンドが正解と判定してボールを返したとき", () => {
      async function submitCorrectGuess() {
        server.use(http.post(apiUrl("/quest/guess-name"), () => HttpResponse.json(guessCorrect)));
        const { result } = await mountInTranslating();
        await act(async () => {
          await result.current.submitGuess("Pikachu");
        });
        return result;
      }

      it("バックエンドが返した名前当ての結果が得られる", async () => {
        const result = await submitCorrectGuess();

        expect(result.current.guessResult).toEqual(guessCorrect);
      });

      it("獲得したボールが、バックエンドが返したボールになる", async () => {
        const result = await submitCorrectGuess();

        expect(result.current.ballType).toBe("ultra");
      });
    });
  });
});

describe("[クエスト] 名前当てのスキップ", () => {
  describe("正常系", () => {
    describe("名前当てをスキップし、バックエンドがボールを返したとき", () => {
      async function skipGuessSuccessfully() {
        server.use(
          http.post(apiUrl("/quest/skip-guess"), () => HttpResponse.json({ ball_type: "poke" })),
        );
        const { result } = await mountInTranslating();
        await act(async () => {
          await result.current.skipGuess();
        });
        return result;
      }

      it("バックエンドへスキップの通信が 1 回送られる", async () => {
        await skipGuessSuccessfully();

        expect(countRequests("/quest/skip-guess")).toBe(1);
      });

      it("獲得したボールが、バックエンドが返したボールになる", async () => {
        const result = await skipGuessSuccessfully();

        expect(result.current.ballType).toBe("poke");
      });

      it("捕獲待機の段階になる", async () => {
        const result = await skipGuessSuccessfully();

        expect(result.current.phase).toBe("capturing");
      });
    });
  });
});

describe("[クエスト] 名前当てから捕獲待機への移行", () => {
  describe("正常系", () => {
    describe("名前当てに正解した後、捕獲へ進む操作をしたとき", () => {
      async function proceedToCaptureAfterCorrectGuess() {
        server.use(http.post(apiUrl("/quest/guess-name"), () => HttpResponse.json(guessCorrect)));
        const { result } = await mountInTranslating();
        await act(async () => {
          await result.current.submitGuess("Pikachu");
        });
        act(() => {
          result.current.proceedToCapture();
        });
        return result;
      }

      it("捕獲待機の段階になる", async () => {
        const result = await proceedToCaptureAfterCorrectGuess();

        expect(result.current.phase).toBe("capturing");
      });

      it("スキップの通信はバックエンドへ送られない", async () => {
        await proceedToCaptureAfterCorrectGuess();

        expect(countRequests("/quest/skip-guess")).toBe(0);
      });
    });
  });
});

describe("[クエスト] ヒントの要求", () => {
  describe("正常系", () => {
    describe("ヒントを要求し、バックエンドがタイプと残り挑戦回数を返したとき", () => {
      async function requestHintOnce() {
        server.use(
          http.post(apiUrl("/quest/hint"), () =>
            HttpResponse.json({ types: ["electric"], attempts_remaining: 2 }),
          ),
        );
        const { result } = await mountInTranslating();
        await act(async () => {
          await result.current.requestHint();
        });
        return result;
      }

      it("バックエンドが返したヒントの内容が得られる", async () => {
        const result = await requestHintOnce();

        expect(result.current.hintResult).toEqual({ types: ["electric"], attempts_remaining: 2 });
      });

      it("残り挑戦回数が、バックエンドが返した値になる", async () => {
        const result = await requestHintOnce();

        expect(result.current.attemptsRemaining).toBe(2);
      });
    });

    describe("1 回目のヒントでタイプ、2 回目のヒントで技を取得したとき", () => {
      async function requestHintTwice() {
        server.use(
          http.post(apiUrl("/quest/hint"), () =>
            HttpResponse.json({ types: ["electric"], attempts_remaining: 2 }),
          ),
        );
        const { result } = await mountInTranslating();
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
        return result;
      }

      it("2 回目の後も、1 回目に取得したタイプと 2 回目に取得した技の両方が得られる", async () => {
        const result = await requestHintTwice();

        expect(result.current.hintResult).toEqual({
          types: ["electric"],
          moves: ["たいあたり", "なきごえ", "でんきショック"],
          attempts_remaining: 1,
        });
      });

      it("残り挑戦回数が、2 回目にバックエンドが返した値になる", async () => {
        const result = await requestHintTwice();

        expect(result.current.attemptsRemaining).toBe(1);
      });
    });
  });
});

describe("[クエスト] 捕獲の実行", () => {
  describe("正常系", () => {
    describe("捕獲を実行し、バックエンドが捕獲結果を返したとき", () => {
      async function captureSuccessfully() {
        server.use(http.post(apiUrl("/quest/capture"), () => HttpResponse.json(captureResp)));
        const { result } = await mountInTranslating();
        await act(async () => {
          await result.current.capture();
        });
        return result;
      }

      it("捕獲演出の段階になる", async () => {
        const result = await captureSuccessfully();

        expect(result.current.phase).toBe("revealing");
      });

      it("バックエンドが返した捕獲結果が得られる", async () => {
        const result = await captureSuccessfully();

        expect(result.current.captureResult).toEqual(captureResp);
      });
    });

    describe("捕獲演出の段階で、演出が終わったとき", () => {
      async function finishCaptureEffect() {
        server.use(http.post(apiUrl("/quest/capture"), () => HttpResponse.json(captureFailed)));
        const { result } = await mountInTranslating();
        await act(async () => {
          await result.current.capture();
        });
        expect(result.current.phase).toBe("revealing");
        act(() => {
          result.current.revealCaptureResult();
        });
        return result;
      }

      it("結果画面の段階になる", async () => {
        const result = await finishCaptureEffect();

        expect(result.current.phase).toBe("result");
      });

      it("捕獲結果が演出の前と同じ内容のまま得られる", async () => {
        const result = await finishCaptureEffect();

        expect(result.current.captureResult).toEqual(captureFailed);
      });
    });
  });
});

describe("[クエスト] 新しいクエストの開始", () => {
  describe("正常系", () => {
    describe("採点・名前当ての正解・ヒントの要求まで進めたクエストで、新しいクエストを開始したとき", () => {
      it("場所選択の段階に戻る", async () => {
        const { result } = await startNewQuestAfterProgress();

        expect(result.current.phase).toBe("selectLocation");
      });

      it("採点結果が破棄される", async () => {
        const { result } = await startNewQuestAfterProgress();

        expect(result.current.score).toBeNull();
      });

      it("入力した訳文が空になる", async () => {
        const { result } = await startNewQuestAfterProgress();

        expect(result.current.userTranslation).toBe("");
      });

      it("獲得したボールが未確定に戻る", async () => {
        const { result } = await startNewQuestAfterProgress();

        expect(result.current.ballType).toBeNull();
      });

      it("残り挑戦回数が未確定に戻る", async () => {
        const { result } = await startNewQuestAfterProgress();

        expect(result.current.attemptsRemaining).toBeNull();
      });

      it("ヒントが破棄される", async () => {
        const { result } = await startNewQuestAfterProgress();

        expect(result.current.hintResult).toBeNull();
      });
    });

    describe("新しいクエストを開始した後、場所を選び直したとき", () => {
      async function reselectLocation() {
        const { result } = await startNewQuestAfterProgress();
        await waitFor(() => expect(result.current.locations.length).toBeGreaterThan(0));
        await act(async () => {
          await result.current.selectLocation(result.current.locations[0].id);
        });
        return result;
      }

      it("訳文入力の段階になる", async () => {
        const result = await reselectLocation();

        expect(result.current.phase).toBe("translating");
      });

      it("バックエンドが返した新しい出題の内容が得られる", async () => {
        const result = await reselectLocation();

        expect(result.current.quest).toEqual({ ...questResp, pokemon_id: 1 });
      });
    });
  });
});

describe("[クエスト] 進行中の通信エラーの扱い", () => {
  describe("異常系", () => {
    async function mountAndCall(
      path: string,
      status: number,
      body: Record<string, string>,
      call: (r: QuestHook) => Promise<unknown>,
    ) {
      server.use(http.post(apiUrl(path), () => HttpResponse.json(body, { status })));
      const hook = await mountInTranslating();
      await act(async () => {
        await call(hook.result.current);
      });
      return hook.result;
    }

    describe("バックエンドが 429 を返したとき", () => {
      const limitBody = { error: "user", message: "x" };

      it.each(operationRows)("%sと、エラーメッセージは出ない", async (_operation, { path, call }) => {
        const result = await mountAndCall(path, 429, limitBody, call);

        expect(result.current.error).toBeNull();
      });

      it.each(operationRows)("%sと、操作の前の段階のまま変わらない", async (_operation, { path, call }) => {
        const result = await mountAndCall(path, 429, limitBody, call);

        expect(result.current.phase).toBe("translating");
      });
    });

    describe("バックエンドが 502 を返したとき", () => {
      it.each(operationRows)(
        "%sと、エラーメッセージに「外部サービスが応答しません」が含まれる",
        async (_operation, { path, call }) => {
          const result = await mountAndCall(path, 502, {}, call);

          expect(result.current.error).toContain("外部サービスが応答しません");
        },
      );

      it.each(operationRows)("%sと、操作の前の段階のまま変わらない", async (_operation, { path, call }) => {
        const result = await mountAndCall(path, 502, {}, call);

        expect(result.current.phase).toBe("translating");
      });
    });

    describe("バックエンドが 502 を返して失敗した後、同じ操作をもう一度行って成功したとき", () => {
      it.each(operationRows)("%sと、エラーメッセージが消える", async (_operation, { path, call, buildSuccess }) => {
        const result = await mountAndCall(path, 502, {}, call);
        expect(result.current.error).not.toBeNull();

        server.use(http.post(apiUrl(path), buildSuccess));
        await act(async () => {
          await call(result.current);
        });

        expect(result.current.error).toBeNull();
      });
    });

    describe("バックエンドが 404 を返したとき", () => {
      it.each(operationRows)("%sと、エラー画面になる", async (_operation, { path, call }) => {
        const result = await mountAndCall(path, 404, {}, call);

        expect(result.current.phase).toBe("error");
      });

      it.each(operationRows)(
        "%sと、エラーメッセージに「セッションが切断されました」が含まれる",
        async (_operation, { path, call }) => {
          const result = await mountAndCall(path, 404, {}, call);

          expect(result.current.error).toContain("セッションが切断されました");
        },
      );
    });
  });
});

describe("[リロード再開] クエストの復元", () => {
  describe("正常系", () => {
    it("進行中のクエストが無いとき、起動すると、場所の一覧が得られる", async () => {
      const { result } = renderHook(() => useQuest(), { wrapper: Wrapper });

      await waitFor(() => expect(result.current.locations.length).toBeGreaterThan(0));
    });

    describe("起動時に採点前のセッションがあるとき", () => {
      beforeEach(() => {
        server.use(
          http.get(apiUrl("/quest/current"), () =>
            HttpResponse.json({ phase: "translating", quest: questResp }),
          ),
        );
      });

      it("訳文入力の段階として復元される", async () => {
        const { result } = renderHook(() => useQuest(), { wrapper: Wrapper });

        await waitFor(() => expect(result.current.phase).toBe("translating"));
      });

      it("出題の内容が復元される", async () => {
        const { result } = renderHook(() => useQuest(), { wrapper: Wrapper });
        await waitFor(() => expect(result.current.phase).toBe("translating"));

        expect(result.current.quest).toEqual(questResp);
      });

      it("場所の一覧はバックエンドから取得されない", async () => {
        const { result } = renderHook(() => useQuest(), { wrapper: Wrapper });
        await waitFor(() => expect(result.current.phase).toBe("translating"));

        expect(countRequests("/quest/locations")).toBe(0);
      });
    });

    describe("起動時に採点後で名前当てが確定していないセッションがあるとき", () => {
      const mockGuessingSession = (hint: unknown) =>
        server.use(
          http.get(apiUrl("/quest/current"), () =>
            HttpResponse.json({
              phase: "guessing",
              quest: questResp,
              score: scoreResp,
              user_translation: "テスト訳",
              attempts_remaining: 2,
              hint,
            }),
          ),
        );
      const electricHint = { types: ["electric"], attempts_remaining: 2 };

      async function mountRestoredGuessing(hint: unknown) {
        mockGuessingSession(hint);
        const { result } = renderHook(() => useQuest(), { wrapper: Wrapper });
        await waitFor(() => expect(result.current.phase).toBe("guessing"));
        return result;
      }

      it("名前当ての段階として復元される", async () => {
        const result = await mountRestoredGuessing(electricHint);

        expect(result.current.phase).toBe("guessing");
      });

      it("採点結果が復元される", async () => {
        const result = await mountRestoredGuessing(electricHint);

        expect(result.current.score).toEqual(scoreResp);
      });

      it("入力した訳文が復元される", async () => {
        const result = await mountRestoredGuessing(electricHint);

        expect(result.current.userTranslation).toBe("テスト訳");
      });

      it("残り挑戦回数が復元される", async () => {
        const result = await mountRestoredGuessing(electricHint);

        expect(result.current.attemptsRemaining).toBe(2);
      });

      it("ヒントが復元される", async () => {
        const result = await mountRestoredGuessing(electricHint);

        expect(result.current.hintResult).toEqual(electricHint);
      });

      it("名前当ての正誤の結果は復元されない", async () => {
        const result = await mountRestoredGuessing(null);

        expect(result.current.guessResult).toBeNull();
      });
    });

    describe("起動時に名前当てが確定済みのセッションがあるとき", () => {
      async function mountRestoredCapturing() {
        server.use(
          http.get(apiUrl("/quest/current"), () =>
            HttpResponse.json({ phase: "capturing", quest: questResp, ball_type: "ultra" }),
          ),
        );
        const { result } = renderHook(() => useQuest(), { wrapper: Wrapper });
        await waitFor(() => expect(result.current.phase).toBe("capturing"));
        return result;
      }

      it("捕獲待機の段階として復元される", async () => {
        const result = await mountRestoredCapturing();

        expect(result.current.phase).toBe("capturing");
      });

      it("確定済みのボールが復元される", async () => {
        const result = await mountRestoredCapturing();

        expect(result.current.ballType).toBe("ultra");
      });
    });

    describe("リロード再開を無効にしているとき、セッションがあっても", () => {
      async function mountWithResumeDisabled() {
        server.use(
          http.get(apiUrl("/quest/current"), () =>
            HttpResponse.json({ phase: "translating", quest: questResp }),
          ),
        );
        const { result } = renderHook(() => useQuest({ enableResume: false }), { wrapper: Wrapper });
        await waitFor(() => expect(result.current.locations.length).toBeGreaterThan(0));
        return result;
      }

      it("場所選択の段階から始まる", async () => {
        const result = await mountWithResumeDisabled();

        expect(result.current.phase).toBe("selectLocation");
      });

      it("現在のクエストをバックエンドへ問い合わせない", async () => {
        await mountWithResumeDisabled();

        expect(countRequests("/quest/current")).toBe(0);
      });
    });
  });

  describe("異常系", () => {
    describe("起動時に現在のクエストの問い合わせが 502 で失敗したとき", () => {
      async function mountWithCurrentQuestFailure() {
        server.use(http.get(apiUrl("/quest/current"), () => HttpResponse.json({}, { status: 502 })));
        const { result } = renderHook(() => useQuest(), { wrapper: Wrapper });
        await waitFor(() => expect(result.current.phase).toBe("error"));
        return result;
      }

      it("エラー画面になる", async () => {
        const result = await mountWithCurrentQuestFailure();

        expect(result.current.phase).toBe("error");
      });

      it("エラーメッセージに「外部サービスが応答しません」が含まれる", async () => {
        const result = await mountWithCurrentQuestFailure();

        expect(result.current.error).toContain("外部サービスが応答しません");
      });

      it("場所の一覧はバックエンドから取得されない", async () => {
        await mountWithCurrentQuestFailure();

        expect(countRequests("/quest/locations")).toBe(0);
      });
    });

    describe("現在のクエストの問い合わせが 502 で失敗した後、「もう一度探す」でセッションが無いとわかったとき", () => {
      async function retryAfterCurrentQuestFailure() {
        server.use(http.get(apiUrl("/quest/current"), () => HttpResponse.json({}, { status: 502 })));
        const { result } = renderHook(() => useQuest(), { wrapper: Wrapper });
        await waitFor(() => expect(result.current.phase).toBe("error"));

        server.use(http.get(apiUrl("/quest/current"), () => new HttpResponse(null, { status: 404 })));
        await act(async () => {
          await result.current.startNewQuest();
        });
        return result;
      }

      it("場所選択の段階になる", async () => {
        const result = await retryAfterCurrentQuestFailure();

        expect(result.current.phase).toBe("selectLocation");
      });

      it("場所の一覧が得られる", async () => {
        const result = await retryAfterCurrentQuestFailure();

        await waitFor(() => expect(result.current.locations.length).toBeGreaterThan(0));
      });

      it("エラーメッセージが消える", async () => {
        const result = await retryAfterCurrentQuestFailure();

        expect(result.current.error).toBeNull();
      });
    });
  });
});
