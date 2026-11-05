import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import type { User } from "firebase/auth";
import type {
  QuestNewResponse,
  QuestLocation,
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

const grasslandLocation: QuestLocation = {
  id: "test-place",
  name: "テスト草原",
  description: "テスト用の場所",
  types: ["normal"],
};

/**
 * GET /quest/new が指定の出題を返す状態をモックする。
 * @param resp 返す出題レスポンス。
 */
function mockNewQuest(resp: QuestNewResponse = questResp) {
  server.use(http.get(apiUrl("/quest/new"), () => HttpResponse.json(resp)));
}

/** GET /quest/locations が「テスト草原」の 1 件を返す状態をモックする。 */
function mockGrasslandLocation() {
  server.use(
    http.get(apiUrl("/quest/locations"), () =>
      HttpResponse.json({ locations: [grasslandLocation] }),
    ),
  );
}

/** GET /quest/current が 404 (進行中のセッションが無い) を返す状態をモックする。 */
function mockNoQuestInProgress() {
  server.use(
    http.get(
      apiUrl("/quest/current"),
      () => new HttpResponse(null, { status: 404 }),
    ),
  );
}

/**
 * useQuest をマウントし、最初の場所を選んで出題を開始した状態にする。
 * @returns renderHook の戻り値。
 */
async function mountAndSelectLocation() {
  const hook = renderHook(() => useQuest(), { wrapper: Wrapper });
  await waitFor(() =>
    expect(hook.result.current.locations.length).toBeGreaterThan(0),
  );
  await act(async () => {
    await hook.result.current.selectLocation(
      hook.result.current.locations[0].id,
    );
  });
  return hook;
}

/**
 * 出題を得て翻訳の入力画面の段階になるまで進めた useQuest をマウントする。
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

interface CommunicationOperation {
  path: string;
  call: (r: QuestHook) => Promise<unknown>;
  buildSuccess: () => Response;
  recoveredOutcome: string;
  expectRecovered: (r: QuestHook) => void;
}

const translationOperation: CommunicationOperation = {
  path: "/quest/score",
  call: (r) => r.submitTranslation("yaku"),
  buildSuccess: () => HttpResponse.json(scoreResp),
  recoveredOutcome:
    "表示画面が名前当て画面になり、採点結果は、最終評価点 75、講評「review」、日本語版の説明「ja desc」になる",
  expectRecovered: (r) => {
    expect(r.phase).toBe("guessing");
    expect(r.score).toEqual(scoreResp);
  },
};

const guessOperation: CommunicationOperation = {
  path: "/quest/guess-name",
  call: (r) => r.submitGuess("Pikachu"),
  buildSuccess: () =>
    HttpResponse.json({ correct: false, attempts_remaining: 2 }),
  recoveredOutcome: "名前当ての結果は、不正解、残り挑戦回数 2 になる",
  expectRecovered: (r) => {
    expect(r.guessResult).toEqual({ correct: false, attempts_remaining: 2 });
  },
};

const hintOperation: CommunicationOperation = {
  path: "/quest/hint",
  call: (r) => r.requestHint(),
  buildSuccess: () =>
    HttpResponse.json({ types: ["electric"], attempts_remaining: 2 }),
  recoveredOutcome: "ヒントの内容は、タイプ「でんき」、残り挑戦回数 2 になる",
  expectRecovered: (r) => {
    expect(r.hintResult).toEqual({
      types: ["electric"],
      attempts_remaining: 2,
    });
  },
};

const captureOperation: CommunicationOperation = {
  path: "/quest/capture",
  call: (r) => r.capture(),
  buildSuccess: () => HttpResponse.json(captureResp),
  recoveredOutcome:
    "表示画面が捕獲演出画面になり、捕獲結果は、捕獲成功、捕獲確率 0.9、ピカチュウ (図鑑番号 25)、最終評価点 75、ハイパーボールになる",
  expectRecovered: (r) => {
    expect(r.phase).toBe("revealing");
    expect(r.captureResult).toEqual(captureResp);
  },
};

const skipGuessOperation: CommunicationOperation = {
  path: "/quest/skip-guess",
  call: (r) => r.skipGuess(),
  buildSuccess: () => HttpResponse.json({ ball_type: "poke" }),
  recoveredOutcome:
    "表示画面が捕獲待機画面になり、獲得したボールはモンスターボールになる",
  expectRecovered: (r) => {
    expect(r.phase).toBe("capturing");
    expect(r.ballType).toBe("poke");
  },
};

async function startNewQuestAfterProgress() {
  mockNoQuestInProgress();
  server.use(
    http.post(apiUrl("/quest/score"), () => HttpResponse.json(scoreResp)),
    http.post(apiUrl("/quest/guess-name"), () =>
      HttpResponse.json(guessCorrect),
    ),
    http.post(apiUrl("/quest/hint"), () =>
      HttpResponse.json({ types: ["normal"], attempts_remaining: 2 }),
    ),
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

describe("[本体:出題]場所選択と出題の開始", () => {
  describe("バックエンドが出題を返すとき", () => {
    describe("場所の選択画面で場所を選ぶと", () => {
      describe("部品間結合テスト", () => {
        describe("正常系", () => {
          it("呼び出し元に返る表示画面が翻訳の入力画面になる", async () => {
            mockNewQuest();

            const { result } = await mountAndSelectLocation();

            await waitFor(() =>
              expect(result.current.phase).toBe("translating"),
            );
          });

          it("バックエンドが図鑑番号 25、英語の説明文「A wild creature.」、伝説でも幻でもない、最大挑戦回数 3 の出題を返すとき、呼び出し元に返る出題の内容は、図鑑番号 25、英語の説明文「A wild creature.」、伝説でも幻でもない、最大挑戦回数 3 になる", async () => {
            mockNewQuest();

            const { result } = await mountAndSelectLocation();

            await waitFor(() =>
              expect(result.current.quest).toEqual(questResp),
            );
          });
        });
      });
    });
  });

  describe("場所を選んだ後の出題の取得が 500 で失敗したとき", () => {
    describe("場所の選択画面で場所を選ぶと", () => {
      describe("部品間結合テスト", () => {
        describe("異常系", () => {
          const mockNewQuestFailure = () =>
            server.use(
              http.get(apiUrl("/quest/new"), () =>
                HttpResponse.json({}, { status: 500 }),
              ),
            );

          it("呼び出し元に返る表示画面がエラー画面になる", async () => {
            mockNewQuestFailure();

            const { result } = await mountAndSelectLocation();

            await waitFor(() => expect(result.current.phase).toBe("error"));
          });

          it("エラーメッセージに「データの読み込みに失敗しました」が含まれる", async () => {
            mockNewQuestFailure();

            const { result } = await mountAndSelectLocation();
            await waitFor(() => expect(result.current.phase).toBe("error"));

            expect(result.current.error).toContain(
              "データの読み込みに失敗しました",
            );
          });
        });
      });
    });
  });

  describe("場所を選んだ後の出題の取得が失敗したとき", () => {
    describe("場所の選択画面で場所を選ぶと", () => {
      describe("部品間結合テスト", () => {
        describe("異常系", () => {
          async function selectLocationWhenNewQuestFails(status: number) {
            server.use(
              http.get(apiUrl("/quest/new"), () =>
                HttpResponse.json({}, { status }),
              ),
            );

            const { result } = await mountAndSelectLocation();
            await waitFor(() => expect(result.current.phase).toBe("error"));
            return result;
          }

          it("出題の取得が 401 で失敗したとき、エラーメッセージに「認証に失敗しました」が含まれる", async () => {
            const result = await selectLocationWhenNewQuestFails(401);

            expect(result.current.error).toContain("認証に失敗しました");
          });

          it("出題の取得が 403 で失敗したとき、エラーメッセージに「アクセス権がありません」が含まれる", async () => {
            const result = await selectLocationWhenNewQuestFails(403);

            expect(result.current.error).toContain("アクセス権がありません");
          });

          it("出題の取得が 404 で失敗したとき、エラーメッセージに「セッションが切断されました」が含まれる", async () => {
            const result = await selectLocationWhenNewQuestFails(404);

            expect(result.current.error).toContain(
              "セッションが切断されました",
            );
          });

          it("出題の取得が 502 で失敗したとき、エラーメッセージに「外部サービスが応答しません」が含まれる", async () => {
            const result = await selectLocationWhenNewQuestFails(502);

            expect(result.current.error).toContain(
              "外部サービスが応答しません",
            );
          });

          it("ネットワークが切れていて応答が無いとき、エラーメッセージに「サーバーに接続できません」が含まれる", async () => {
            server.use(
              http.get(apiUrl("/quest/new"), () => HttpResponse.error()),
            );

            const { result } = await mountAndSelectLocation();
            await waitFor(() => expect(result.current.phase).toBe("error"));

            expect(result.current.error).toContain("サーバーに接続できません");
          });
        });
      });
    });
  });

  describe("場所を選んだ後の出題の取得が失敗してエラー画面が出た後、現在のクエストの問い合わせが 404 (進行中のセッションが無い) を返し、バックエンドが図鑑番号 25、英語の説明文「A wild creature.」、伝説でも幻でもない、最大挑戦回数 3 の出題を返すとき", () => {
    describe("エラー画面で「もう一度探す」を押して場所を選び直すと", () => {
      describe("部品間結合テスト", () => {
        describe("異常系", () => {
          const newQuestFailures = [
            {
              message: "データの読み込みに失敗しました",
              fail: () =>
                server.use(
                  http.get(apiUrl("/quest/new"), () =>
                    HttpResponse.json({}, { status: 500 }),
                  ),
                ),
            },
            {
              message: "認証に失敗しました",
              fail: () =>
                server.use(
                  http.get(apiUrl("/quest/new"), () =>
                    HttpResponse.json({}, { status: 401 }),
                  ),
                ),
            },
            {
              message: "アクセス権がありません",
              fail: () =>
                server.use(
                  http.get(apiUrl("/quest/new"), () =>
                    HttpResponse.json({}, { status: 403 }),
                  ),
                ),
            },
            {
              message: "セッションが切断されました",
              fail: () =>
                server.use(
                  http.get(apiUrl("/quest/new"), () =>
                    HttpResponse.json({}, { status: 404 }),
                  ),
                ),
            },
            {
              message: "サーバーに接続できません",
              fail: () =>
                server.use(
                  http.get(apiUrl("/quest/new"), () => HttpResponse.error()),
                ),
            },
          ];

          async function retryAfterNewQuestFailure(fail: () => void) {
            fail();
            const failed = await mountAndSelectLocation();
            await waitFor(() =>
              expect(failed.result.current.phase).toBe("error"),
            );

            mockNoQuestInProgress();
            mockNewQuest();
            await act(async () => {
              await failed.result.current.startNewQuest();
            });
            await waitFor(() =>
              expect(failed.result.current.locations.length).toBeGreaterThan(0),
            );
            await act(async () => {
              await failed.result.current.selectLocation(
                failed.result.current.locations[0].id,
              );
            });
            return failed.result;
          }

          it.each(newQuestFailures)(
            "エラーメッセージが「$message」だったとき、呼び出し元に返る表示画面が翻訳の入力画面になる",
            async ({ fail }) => {
              const result = await retryAfterNewQuestFailure(fail);

              await waitFor(() =>
                expect(result.current.phase).toBe("translating"),
              );
            },
          );

          it.each(newQuestFailures)(
            "エラーメッセージが「$message」だったとき、エラーメッセージが消える",
            async ({ fail }) => {
              const result = await retryAfterNewQuestFailure(fail);

              await waitFor(() =>
                expect(result.current.phase).toBe("translating"),
              );
              expect(result.current.error).toBeNull();
            },
          );
        });
      });
    });
  });
});

describe("[本体:採点]翻訳の採点", () => {
  describe("バックエンドが最終評価点 75、講評「review」、日本語版の説明「ja desc」の採点結果を返すとき", () => {
    describe("翻訳の入力画面で翻訳「テスト翻訳」を送信すると", () => {
      describe("部品間結合テスト", () => {
        describe("正常系", () => {
          async function submitTranslationSuccessfully() {
            server.use(
              http.post(apiUrl("/quest/score"), () =>
                HttpResponse.json(scoreResp),
              ),
            );
            const { result } = await mountInTranslating();
            await act(async () => {
              await result.current.submitTranslation("テスト翻訳");
            });
            return result;
          }

          it("呼び出し元に返る表示画面が名前当て画面になる", async () => {
            const result = await submitTranslationSuccessfully();

            expect(result.current.phase).toBe("guessing");
          });

          it("呼び出し元に返る採点結果は、最終評価点 75、講評「review」、日本語版の説明「ja desc」になる", async () => {
            const result = await submitTranslationSuccessfully();

            expect(result.current.score).toEqual(scoreResp);
          });

          it("呼び出し元に返る入力した翻訳は「テスト翻訳」になる", async () => {
            const result = await submitTranslationSuccessfully();

            expect(result.current.userTranslation).toBe("テスト翻訳");
          });
        });
      });
    });
  });
});

describe("[本体:名前当て]名前当ての回答", () => {
  describe("バックエンドが、正解、獲得したボールはハイパーボール、回答の言語は英語、残り挑戦回数 2 を返すとき", () => {
    describe("出題を得た直後の翻訳の入力画面で、名前「Pikachu」を送信すると", () => {
      describe("部品間結合テスト", () => {
        describe("正常系", () => {
          async function submitCorrectGuess() {
            server.use(
              http.post(apiUrl("/quest/guess-name"), () =>
                HttpResponse.json(guessCorrect),
              ),
            );
            const { result } = await mountInTranslating();
            await act(async () => {
              await result.current.submitGuess("Pikachu");
            });
            return result;
          }

          it("呼び出し元に返る名前当ての結果は、正解、ハイパーボール、回答の言語は英語、残り挑戦回数 2 になる", async () => {
            const result = await submitCorrectGuess();

            expect(result.current.guessResult).toEqual(guessCorrect);
          });

          it("呼び出し元に返る獲得したボールはハイパーボールになる", async () => {
            const result = await submitCorrectGuess();

            expect(result.current.ballType).toBe("ultra");
          });
        });
      });
    });
  });
});

describe("[本体:名前当て]名前当てのスキップ", () => {
  describe("バックエンドがモンスターボールを返すとき", () => {
    describe("出題を得た直後の翻訳の入力画面で、名前当てをスキップすると", () => {
      describe("部品間結合テスト", () => {
        describe("正常系", () => {
          async function skipGuessSuccessfully() {
            server.use(
              http.post(apiUrl("/quest/skip-guess"), () =>
                HttpResponse.json({ ball_type: "poke" }),
              ),
            );
            const { result } = await mountInTranslating();
            await act(async () => {
              await result.current.skipGuess();
            });
            return result;
          }

          it("バックエンドへスキップの要求が 1 回届く", async () => {
            await skipGuessSuccessfully();

            expect(countRequests("/quest/skip-guess")).toBe(1);
          });

          it("呼び出し元に返る獲得したボールはモンスターボールになる", async () => {
            const result = await skipGuessSuccessfully();

            expect(result.current.ballType).toBe("poke");
          });

          it("呼び出し元に返る表示画面が捕獲待機画面になる", async () => {
            const result = await skipGuessSuccessfully();

            expect(result.current.phase).toBe("capturing");
          });
        });
      });
    });
  });
});

describe("[本体:名前当て]名前当てから捕獲待機への移行", () => {
  describe("名前「Pikachu」の送信に正解し、ハイパーボールを獲得した後のとき", () => {
    describe("「次へ進む」を押すと", () => {
      describe("部品間結合テスト", () => {
        describe("正常系", () => {
          async function proceedToCaptureAfterCorrectGuess() {
            server.use(
              http.post(apiUrl("/quest/guess-name"), () =>
                HttpResponse.json(guessCorrect),
              ),
            );
            const { result } = await mountInTranslating();
            await act(async () => {
              await result.current.submitGuess("Pikachu");
            });
            act(() => {
              result.current.proceedToCapture();
            });
            return result;
          }

          it("呼び出し元に返る表示画面が捕獲待機画面になる", async () => {
            const result = await proceedToCaptureAfterCorrectGuess();

            expect(result.current.phase).toBe("capturing");
          });

          it("バックエンドへスキップの要求が届かない", async () => {
            await proceedToCaptureAfterCorrectGuess();

            expect(countRequests("/quest/skip-guess")).toBe(0);
          });
        });
      });
    });
  });
});

describe("[本体:名前当て]ヒントの要求", () => {
  describe("バックエンドがタイプ「でんき」と残り挑戦回数 2 を返すとき", () => {
    describe("出題を得た直後の翻訳の入力画面で、ヒントを要求すると", () => {
      describe("部品間結合テスト", () => {
        describe("正常系", () => {
          async function requestHintOnce() {
            server.use(
              http.post(apiUrl("/quest/hint"), () =>
                HttpResponse.json({
                  types: ["electric"],
                  attempts_remaining: 2,
                }),
              ),
            );
            const { result } = await mountInTranslating();
            await act(async () => {
              await result.current.requestHint();
            });
            return result;
          }

          it("呼び出し元に返るヒントの内容は、タイプ「でんき」、残り挑戦回数 2 になる", async () => {
            const result = await requestHintOnce();

            expect(result.current.hintResult).toEqual({
              types: ["electric"],
              attempts_remaining: 2,
            });
          });

          it("呼び出し元に返る残り挑戦回数は 2 になる", async () => {
            const result = await requestHintOnce();

            expect(result.current.attemptsRemaining).toBe(2);
          });
        });
      });
    });
  });

  describe("1 回目の要求でバックエンドがタイプ「でんき」と残り挑戦回数 2 を返し、2 回目の要求で技「たいあたり」「なきごえ」「でんきショック」と残り挑戦回数 1 を返すとき", () => {
    describe("出題を得た直後の翻訳の入力画面で、ヒントを 2 回続けて要求すると", () => {
      describe("部品間結合テスト", () => {
        describe("正常系", () => {
          async function requestHintTwice() {
            server.use(
              http.post(apiUrl("/quest/hint"), () =>
                HttpResponse.json({
                  types: ["electric"],
                  attempts_remaining: 2,
                }),
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

          it("呼び出し元に返るヒントの内容は、タイプ「でんき」と、技「たいあたり」「なきごえ」「でんきショック」の両方を含み、残り挑戦回数 1 になる", async () => {
            const result = await requestHintTwice();

            expect(result.current.hintResult).toEqual({
              types: ["electric"],
              moves: ["たいあたり", "なきごえ", "でんきショック"],
              attempts_remaining: 1,
            });
          });

          it("呼び出し元に返る残り挑戦回数は 1 になる", async () => {
            const result = await requestHintTwice();

            expect(result.current.attemptsRemaining).toBe(1);
          });
        });
      });
    });
  });
});

describe("[本体:捕獲]捕獲の実行", () => {
  describe("バックエンドが、捕獲成功、捕獲確率 0.9、ピカチュウ (図鑑番号 25)、最終評価点 75、ハイパーボールの捕獲結果を返すとき", () => {
    describe("出題を得た直後の翻訳の入力画面で、捕獲を実行すると", () => {
      describe("部品間結合テスト", () => {
        describe("正常系", () => {
          async function captureSuccessfully() {
            server.use(
              http.post(apiUrl("/quest/capture"), () =>
                HttpResponse.json(captureResp),
              ),
            );
            const { result } = await mountInTranslating();
            await act(async () => {
              await result.current.capture();
            });
            return result;
          }

          it("呼び出し元に返る表示画面が捕獲演出画面になる", async () => {
            const result = await captureSuccessfully();

            expect(result.current.phase).toBe("revealing");
          });

          it("呼び出し元に返る捕獲結果は、捕獲成功、捕獲確率 0.9、ピカチュウ (図鑑番号 25)、最終評価点 75、ハイパーボールになる", async () => {
            const result = await captureSuccessfully();

            expect(result.current.captureResult).toEqual(captureResp);
          });
        });
      });
    });
  });

  describe("バックエンドが、捕獲失敗、捕獲確率 0.2、ピカチュウ (図鑑番号 25)、最終評価点 40、モンスターボールの捕獲結果を返すとき", () => {
    describe("出題を得た直後の翻訳の入力画面で捕獲を実行して捕獲演出画面になった後、演出が終わると", () => {
      describe("部品間結合テスト", () => {
        describe("正常系", () => {
          async function finishCaptureEffect() {
            server.use(
              http.post(apiUrl("/quest/capture"), () =>
                HttpResponse.json(captureFailed),
              ),
            );
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

          it("呼び出し元に返る表示画面が捕獲結果画面になる", async () => {
            const result = await finishCaptureEffect();

            expect(result.current.phase).toBe("result");
          });

          it("呼び出し元に返る捕獲結果は、演出が終わる前と同じ、捕獲失敗、捕獲確率 0.2、ピカチュウ (図鑑番号 25)、最終評価点 40、モンスターボールになる", async () => {
            const result = await finishCaptureEffect();

            expect(result.current.captureResult).toEqual(captureFailed);
          });
        });
      });
    });
  });
});

describe("[本体:出題]新しいクエストの開始", () => {
  describe("現在のクエストの問い合わせが 404 (進行中のセッションが無い) を返す状態で、翻訳「テスト」を送信して最終評価点 75 の採点結果を得て、名前「Pikachu」の送信に正解してハイパーボールを獲得し、ヒントを要求してタイプ「ノーマル」と残り挑戦回数 2 を得た後のとき", () => {
    describe("新しいクエストを開始すると", () => {
      describe("部品間結合テスト", () => {
        describe("正常系", () => {
          it("呼び出し元に返る表示画面が場所の選択画面に戻る", async () => {
            const { result } = await startNewQuestAfterProgress();

            expect(result.current.phase).toBe("selectLocation");
          });

          it("呼び出し元に返る採点結果が無い状態になる", async () => {
            const { result } = await startNewQuestAfterProgress();

            expect(result.current.score).toBeNull();
          });

          it("呼び出し元に返る入力した翻訳が空文字になる", async () => {
            const { result } = await startNewQuestAfterProgress();

            expect(result.current.userTranslation).toBe("");
          });

          it("呼び出し元に返る獲得したボールが無い状態に戻る", async () => {
            const { result } = await startNewQuestAfterProgress();

            expect(result.current.ballType).toBeNull();
          });

          it("呼び出し元に返る残り挑戦回数が無い状態に戻る", async () => {
            const { result } = await startNewQuestAfterProgress();

            expect(result.current.attemptsRemaining).toBeNull();
          });

          it("呼び出し元に返るヒントの内容が無い状態になる", async () => {
            const { result } = await startNewQuestAfterProgress();

            expect(result.current.hintResult).toBeNull();
          });
        });
      });
    });

    describe("新しいクエストを開始した後、バックエンドが図鑑番号 1、英語の説明文「A wild creature.」、伝説でも幻でもない、最大挑戦回数 3 の出題を返すとき", () => {
      describe("場所の選択画面で場所を選び直すと", () => {
        describe("部品間結合テスト", () => {
          describe("正常系", () => {
            async function reselectLocation() {
              const { result } = await startNewQuestAfterProgress();
              await waitFor(() =>
                expect(result.current.locations.length).toBeGreaterThan(0),
              );
              await act(async () => {
                await result.current.selectLocation(
                  result.current.locations[0].id,
                );
              });
              return result;
            }

            it("呼び出し元に返る表示画面が翻訳の入力画面になる", async () => {
              const result = await reselectLocation();

              expect(result.current.phase).toBe("translating");
            });

            it("呼び出し元に返る出題の内容は、図鑑番号 1、英語の説明文「A wild creature.」、伝説でも幻でもない、最大挑戦回数 3 になる", async () => {
              const result = await reselectLocation();

              expect(result.current.quest).toEqual({
                ...questResp,
                pokemon_id: 1,
              });
            });
          });
        });
      });
    });
  });

  describe("もう一度探すときの現在のクエストの問い合わせが 404 (進行中のセッションが無い) を返し、バックエンドが場所「テスト草原」の 1 件を返すとき", () => {
    describe("エラー画面で「もう一度探す」を押すと", () => {
      describe("部品間結合テスト", () => {
        describe("異常系", () => {
          async function retryAfterLocationsFailure() {
            server.use(
              http.get(apiUrl("/quest/locations"), () =>
                HttpResponse.json({}, { status: 500 }),
              ),
            );
            return retryAfterFailureScreen();
          }

          async function retryAfterCurrentQuestFailure() {
            server.use(
              http.get(apiUrl("/quest/current"), () =>
                HttpResponse.json({}, { status: 502 }),
              ),
            );
            return retryAfterFailureScreen();
          }

          async function retryAfterFailureScreen() {
            const { result } = renderHook(() => useQuest(), {
              wrapper: Wrapper,
            });
            await waitFor(() => expect(result.current.phase).toBe("error"));

            mockNoQuestInProgress();
            mockGrasslandLocation();
            await act(async () => {
              await result.current.startNewQuest();
            });
            return result;
          }

          const failures = [
            {
              failure: "場所の一覧の取得が 500 で失敗してエラー画面が出ていたとき",
              retry: retryAfterLocationsFailure,
            },
            {
              failure:
                "現在のクエストの問い合わせが 502 で失敗してエラー画面が出ていたとき",
              retry: retryAfterCurrentQuestFailure,
            },
          ];

          it.each(failures)(
            "$failure、呼び出し元に返る表示画面が場所の選択画面になる",
            async ({ retry }) => {
              const result = await retry();

              expect(result.current.phase).toBe("selectLocation");
            },
          );

          it.each(failures)(
            "$failure、呼び出し元に返る場所の一覧は、「テスト草原」の 1 件になる",
            async ({ retry }) => {
              const result = await retry();

              await waitFor(() =>
                expect(result.current.locations).toEqual([grasslandLocation]),
              );
            },
          );

          it.each(failures)(
            "$failure、エラーメッセージが消える",
            async ({ retry }) => {
              const result = await retry();

              expect(result.current.error).toBeNull();
            },
          );
        });
      });
    });
  });
});

function defineCommunicationErrorCases(operation: CommunicationOperation) {
  const { path, call, buildSuccess, recoveredOutcome, expectRecovered } =
    operation;

  async function mountAndCall(status: number, body: Record<string, string>) {
    server.use(
      http.post(apiUrl(path), () => HttpResponse.json(body, { status })),
    );
    const hook = await mountInTranslating();
    await act(async () => {
      await call(hook.result.current);
    });
    return hook.result;
  }

  async function retryAfterBackendFailure(
    status: number,
    body: Record<string, string>,
  ) {
    const result = await mountAndCall(status, body);
    server.use(http.post(apiUrl(path), buildSuccess));
    await act(async () => {
      await call(result.current);
    });
    return result;
  }

  describe("部品間結合テスト", () => {
    describe("異常系", () => {
      it("バックエンドが 429 を返すとき、エラーメッセージは出ない", async () => {
        const result = await mountAndCall(429, { error: "user", message: "x" });

        expect(result.current.error).toBeNull();
      });

      it("バックエンドが 502 を返すとき、エラーメッセージに「外部サービスが応答しません」が含まれる", async () => {
        const result = await mountAndCall(502, {});

        expect(result.current.error).toContain("外部サービスが応答しません");
      });

      it("バックエンドが 404 (セッション切れ) を返すとき、呼び出し元に返る表示画面がエラー画面になる", async () => {
        const result = await mountAndCall(404, {});

        expect(result.current.phase).toBe("error");
      });

      it("バックエンドが 404 (セッション切れ) を返すとき、エラーメッセージに「セッションが切断されました」が含まれる", async () => {
        const result = await mountAndCall(404, {});

        expect(result.current.error).toContain("セッションが切断されました");
      });

      it("バックエンドが 502 を返して失敗した後、同じ操作をもう一度行ってバックエンドが成功を返したとき、エラーメッセージが消える", async () => {
        const result = await retryAfterBackendFailure(502, {});

        expect(result.current.error).toBeNull();
      });

      it.each([
        [429, { error: "user", message: "x" }],
        [502, {}],
      ])(
        `バックエンドが %i を返して失敗した後、同じ操作をもう一度行ってバックエンドが成功を返したとき、${recoveredOutcome}`,
        async (status, body) => {
          const result = await retryAfterBackendFailure(status, body);

          expectRecovered(result.current);
        },
      );

      it.each([
        [429, { error: "user", message: "x" }],
        [502, {}],
      ])(
        "バックエンドが %i を返すとき、呼び出し元に返る表示画面が翻訳の入力画面のままになる",
        async (status, body) => {
          const result = await mountAndCall(status, body);

          expect(result.current.phase).toBe("translating");
        },
      );
    });
  });
}

describe("[本体:クエスト]進行中の通信エラーの扱い", () => {
  describe("出題を得た直後の翻訳の入力画面にいるとき", () => {
    describe("成功の応答として、バックエンドが最終評価点 75、講評「review」、日本語版の説明「ja desc」の採点結果を返すとき", () => {
      describe("翻訳を送信すると", () => {
        defineCommunicationErrorCases(translationOperation);
      });
    });

    describe("成功の応答として、バックエンドが不正解、残り挑戦回数 2 の名前当ての結果を返すとき", () => {
      describe("名前を送信すると", () => {
        defineCommunicationErrorCases(guessOperation);
      });
    });

    describe("成功の応答として、バックエンドがタイプ「でんき」、残り挑戦回数 2 のヒントを返すとき", () => {
      describe("ヒントを要求すると", () => {
        defineCommunicationErrorCases(hintOperation);
      });
    });

    describe("成功の応答として、バックエンドがモンスターボールを返すとき", () => {
      describe("名前当てをスキップすると", () => {
        defineCommunicationErrorCases(skipGuessOperation);
      });
    });

    describe("成功の応答として、バックエンドが捕獲成功、捕獲確率 0.9、ピカチュウ (図鑑番号 25)、最終評価点 75、ハイパーボールの捕獲結果を返すとき", () => {
      describe("捕獲を実行すると", () => {
        defineCommunicationErrorCases(captureOperation);
      });
    });
  });
});

describe("[本体:リロード再開]クエストの再開", () => {
  describe("現在のクエストの問い合わせが 404 (進行中のセッションが無い) を返し、バックエンドが場所「テスト草原」の 1 件を返すとき", () => {
    describe("クエスト画面を開くと", () => {
      describe("部品間結合テスト", () => {
        describe("正常系", () => {
          it("呼び出し元に返る場所の一覧は、「テスト草原」の 1 件になる", async () => {
            mockNoQuestInProgress();
            mockGrasslandLocation();

            const { result } = renderHook(() => useQuest(), {
              wrapper: Wrapper,
            });

            await waitFor(() =>
              expect(result.current.locations).toEqual([grasslandLocation]),
            );
          });
        });
      });
    });
  });

  describe("現在のクエストの問い合わせが、翻訳の入力画面の段階で図鑑番号 25、英語の説明文「A wild creature.」、伝説でも幻でもない、最大挑戦回数 3 の出題を返すとき", () => {
    describe("クエスト画面を開くと", () => {
      describe("部品間結合テスト", () => {
        describe("正常系", () => {
          async function mountResumedTranslating() {
            server.use(
              http.get(apiUrl("/quest/current"), () =>
                HttpResponse.json({ phase: "translating", quest: questResp }),
              ),
            );
            const { result } = renderHook(() => useQuest(), {
              wrapper: Wrapper,
            });
            await waitFor(() =>
              expect(result.current.phase).toBe("translating"),
            );
            return result;
          }

          it("呼び出し元に返る表示画面が翻訳の入力画面になる", async () => {
            const result = await mountResumedTranslating();

            expect(result.current.phase).toBe("translating");
          });

          it("呼び出し元に返る出題の内容は、図鑑番号 25、英語の説明文「A wild creature.」、伝説でも幻でもない、最大挑戦回数 3 になる", async () => {
            const result = await mountResumedTranslating();

            expect(result.current.quest).toEqual(questResp);
          });

          it("バックエンドへ場所の一覧の取得要求が届かない", async () => {
            await mountResumedTranslating();

            expect(countRequests("/quest/locations")).toBe(0);
          });
        });
      });
    });
  });

  describe("現在のクエストの問い合わせが、名前当て画面の段階で、図鑑番号 25 の出題、最終評価点 75、講評「review」、日本語版の説明「ja desc」の採点結果、翻訳「テスト訳」、残り挑戦回数 2、ヒント (タイプ「でんき」、残り挑戦回数 2) を返すとき", () => {
    describe("クエスト画面を開くと", () => {
      describe("部品間結合テスト", () => {
        describe("正常系", () => {
          const electricHint = { types: ["electric"], attempts_remaining: 2 };

          async function mountResumedGuessing() {
            server.use(
              http.get(apiUrl("/quest/current"), () =>
                HttpResponse.json({
                  phase: "guessing",
                  quest: questResp,
                  score: scoreResp,
                  user_translation: "テスト訳",
                  attempts_remaining: 2,
                  hint: electricHint,
                }),
              ),
            );
            const { result } = renderHook(() => useQuest(), {
              wrapper: Wrapper,
            });
            await waitFor(() => expect(result.current.phase).toBe("guessing"));
            return result;
          }

          it("呼び出し元に返る表示画面が名前当て画面になる", async () => {
            const result = await mountResumedGuessing();

            expect(result.current.phase).toBe("guessing");
          });

          it("呼び出し元に返る採点結果は、最終評価点 75、講評「review」、日本語版の説明「ja desc」になる", async () => {
            const result = await mountResumedGuessing();

            expect(result.current.score).toEqual(scoreResp);
          });

          it("呼び出し元に返る入力した翻訳は「テスト訳」になる", async () => {
            const result = await mountResumedGuessing();

            expect(result.current.userTranslation).toBe("テスト訳");
          });

          it("呼び出し元に返る残り挑戦回数は 2 になる", async () => {
            const result = await mountResumedGuessing();

            expect(result.current.attemptsRemaining).toBe(2);
          });

          it("呼び出し元に返るヒントの内容は、タイプ「でんき」、残り挑戦回数 2 になる", async () => {
            const result = await mountResumedGuessing();

            expect(result.current.hintResult).toEqual(electricHint);
          });

          it("呼び出し元に返る名前当ての結果が無い状態になる", async () => {
            const result = await mountResumedGuessing();

            expect(result.current.guessResult).toBeNull();
          });
        });
      });
    });
  });

  describe("現在のクエストの問い合わせが、捕獲待機画面の段階で、図鑑番号 25 の出題と、確定済みのボール (ハイパーボール) を返すとき", () => {
    describe("クエスト画面を開くと", () => {
      describe("部品間結合テスト", () => {
        describe("正常系", () => {
          async function mountResumedCapturing() {
            server.use(
              http.get(apiUrl("/quest/current"), () =>
                HttpResponse.json({
                  phase: "capturing",
                  quest: questResp,
                  ball_type: "ultra",
                }),
              ),
            );
            const { result } = renderHook(() => useQuest(), {
              wrapper: Wrapper,
            });
            await waitFor(() => expect(result.current.phase).toBe("capturing"));
            return result;
          }

          it("呼び出し元に返る表示画面が捕獲待機画面になる", async () => {
            const result = await mountResumedCapturing();

            expect(result.current.phase).toBe("capturing");
          });

          it("呼び出し元に返る獲得したボールはハイパーボールになる", async () => {
            const result = await mountResumedCapturing();

            expect(result.current.ballType).toBe("ultra");
          });
        });
      });
    });
  });

  describe("現在のクエストの問い合わせが、翻訳の入力画面の段階のセッションを返す状態で、リロード再開を無効にして起動するとき", () => {
    describe("クエスト画面を開くと", () => {
      describe("部品間結合テスト", () => {
        describe("正常系", () => {
          async function mountWithResumeDisabled() {
            server.use(
              http.get(apiUrl("/quest/current"), () =>
                HttpResponse.json({ phase: "translating", quest: questResp }),
              ),
            );
            const { result } = renderHook(
              () => useQuest({ enableResume: false }),
              {
                wrapper: Wrapper,
              },
            );
            await waitFor(() =>
              expect(result.current.locations.length).toBeGreaterThan(0),
            );
            return result;
          }

          it("呼び出し元に返る表示画面が場所の選択画面になる", async () => {
            const result = await mountWithResumeDisabled();

            expect(result.current.phase).toBe("selectLocation");
          });

          it("バックエンドへ現在のクエストの問い合わせが届かない", async () => {
            await mountWithResumeDisabled();

            expect(countRequests("/quest/current")).toBe(0);
          });
        });
      });
    });
  });

  describe("クエスト画面を開くと", () => {
    describe("部品間結合テスト", () => {
      describe("異常系", () => {
        async function mountWithLocationsFailure() {
          server.use(
            http.get(apiUrl("/quest/locations"), () =>
              HttpResponse.json({}, { status: 500 }),
            ),
          );
          const { result } = renderHook(() => useQuest(), {
            wrapper: Wrapper,
          });
          await waitFor(() => expect(result.current.phase).toBe("error"));
          return result;
        }

        async function mountWithCurrentQuestFailure() {
          server.use(
            http.get(apiUrl("/quest/current"), () =>
              HttpResponse.json({}, { status: 502 }),
            ),
          );
          const { result } = renderHook(() => useQuest(), {
            wrapper: Wrapper,
          });
          await waitFor(() => expect(result.current.phase).toBe("error"));
          return result;
        }

        it.each([
          {
            failure: "場所の一覧の取得が 500 で失敗したとき",
            mount: mountWithLocationsFailure,
          },
          {
            failure: "現在のクエストの問い合わせが 502 で失敗したとき",
            mount: mountWithCurrentQuestFailure,
          },
        ])(
          "$failure、呼び出し元に返る表示画面がエラー画面になる",
          async ({ mount }) => {
            const result = await mount();

            expect(result.current.phase).toBe("error");
          },
        );

        it("場所の一覧の取得が 500 で失敗したとき、エラーメッセージに「場所の読み込みに失敗しました」が含まれる", async () => {
          const result = await mountWithLocationsFailure();

          expect(result.current.error).toContain(
            "場所の読み込みに失敗しました",
          );
        });

        it("現在のクエストの問い合わせが 502 で失敗したとき、エラーメッセージに「外部サービスが応答しません」が含まれる", async () => {
          const result = await mountWithCurrentQuestFailure();

          expect(result.current.error).toContain("外部サービスが応答しません");
        });

        it("現在のクエストの問い合わせが 502 で失敗したとき、バックエンドへ場所の一覧の取得要求が届かない", async () => {
          await mountWithCurrentQuestFailure();

          expect(countRequests("/quest/locations")).toBe(0);
        });
      });
    });
  });
});
