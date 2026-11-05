import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { QuestPage } from "./QuestPage";
import { renderWithProviders } from "../test/render";
import { server, apiUrl } from "../test/mswServer";
import { spec } from "../test/labels";
import type { CaptureResponse } from "../../../shared/api-types/quest";

const TRANSLATION_SUBMIT_BUTTON = "この翻訳に決めた！";
const NAME_SUBMIT_BUTTON = "君に　決めた！";
const HINT_BUTTON = "ヒントを見る（チャンスを1回使う）";
const HINT_AGAIN_BUTTON = "別のヒントを見る（チャンスを1回使う）";
const SKIP_BUTTON = "わからないのでスキップ →";
const PROCEED_BUTTON = "次へ進む";
const CORRECT_TITLE = "正解！";
const NEXT_QUEST_BUTTON = "次のポケモンを探す";

type UserSession = ReturnType<typeof userEvent.setup>;

/**
 * 場所を選び、翻訳を入力して送信し、名前当てに進める。
 * @param user userEvent のセッション。
 */
async function startQuestAndSubmitTranslation(user: UserSession): Promise<void> {
  await user.click(await screen.findByRole("button", { name: /テスト草原/ }));
  await user.type(await screen.findByRole("textbox"), "やくぶん");
  await user.click(screen.getByRole("button", { name: TRANSLATION_SUBMIT_BUTTON }));
}

describe("[本体:クエスト]場所の選択", () => {
  describe("場所の候補が「テスト草原」の 1 件のとき", () => {
    describe("クエスト画面を開くと", () => {
      describe("部品間結合テスト", () => {
        describe("正常系", () => {
          it("場所選択画面に、「どこに　ポケモンを　探しに行く？」の見出しが表示される", async () => {
            renderWithProviders(<QuestPage />, { withRouter: true });

            expect(
              await screen.findByRole("heading", { name: "どこに　ポケモンを　探しに行く？" }),
            ).toBeInTheDocument();
          });

          it("場所選択画面に、「テスト草原」のボタンが表示される", async () => {
            renderWithProviders(<QuestPage />, { withRouter: true });

            expect(
              await screen.findByRole("button", { name: /テスト草原/ }),
            ).toBeInTheDocument();
          });
        });
      });
    });
  });
});

describe("[本体:クエスト]出題から捕獲までの一連の流れ", () => {
  describe("部品間結合テスト", () => {
    describe("正常系", () => {
      it("1 回目の出題の英文が「The first wild creature.」、2 回目の出題の英文が「A second wild creature.」で、名前の判定が「ピカチュウ」だけを正解とし、捕獲が成功するとき、場所を選ぶと出題の英文「The first wild creature.」が表示され、翻訳「さいしょのやくぶん」を送信するとその翻訳が表示され、名前「ピカチュウ」を答えると「正解！」が表示され、「次へ進む」を押してハイパーボールを使うと「やったー！　ピカチュウを　捕まえたぞ！」が表示され、「次のポケモンを探す」を押して場所を選ぶと、2 回目の出題の英文「A second wild creature.」が表示される", async () => {
        const user = userEvent.setup();
        let newQuestCall = 0;
        const captured: CaptureResponse = {
          captured: true,
          probability: 0.9,
          pokemon_id: 25,
          name_en: "Pikachu",
          name_ja: "ピカチュウ",
          sprite_url: "https://example.com/25.png",
          score: 80,
          description_en:
            "It raises its tail to check its surroundings. The tail is sometimes struck by lightning in this pose.",
          description_ja: "尻尾を　立てて　まわりの　様子を 探っていると　ときどき 雷が　尻尾に　落ちてくる。",
          base_stat_total: 320,
          ball_type: "ultra",
          types: ["electric"],
          height: 4,
          weight: 60,
          is_legendary: false,
          is_mythical: false,
        };
        server.use(
          http.get(apiUrl("/quest/new"), () => {
            newQuestCall += 1;
            return HttpResponse.json({
              pokemon_id: newQuestCall === 1 ? 25 : 4,
              description_en:
                newQuestCall === 1 ? "The first wild creature." : "A second wild creature.",
              is_legendary: false,
              is_mythical: false,
              max_guess_attempts: 3,
            });
          }),
          http.post(apiUrl("/quest/score"), () =>
            HttpResponse.json({ score: 80, review: "いいね", description_ja: "テストの せつめい" }),
          ),
          http.post(apiUrl("/quest/guess-name"), async ({ request }) => {
            const { guess } = (await request.json()) as { guess: string };
            return HttpResponse.json(
              guess === "ピカチュウ"
                ? { correct: true, ball_type: "ultra", language: "ja", attempts_remaining: 2 }
                : { correct: false, attempts_remaining: 2 },
            );
          }),
          http.post(apiUrl("/quest/capture"), () => HttpResponse.json(captured)),
        );

        renderWithProviders(<QuestPage />, { withRouter: true });

        await user.click(await screen.findByRole("button", { name: /テスト草原/ }));

        const translationBox = await screen.findByRole("textbox");
        // タイプライター演出で全文表示まで実時間がかかるため、既定の待機時間 (1000ms) を延長する。
        await screen.findByText(/The first wild creature\./, {}, { timeout: 3000 });

        await user.type(translationBox, "さいしょのやくぶん");
        await user.click(screen.getByRole("button", { name: TRANSLATION_SUBMIT_BUTTON }));
        expect(await screen.findByText("さいしょのやくぶん")).toBeInTheDocument();

        await user.type(screen.getByRole("textbox"), "ピカチュウ");
        await user.click(screen.getByRole("button", { name: NAME_SUBMIT_BUTTON }));
        expect(await screen.findByText(CORRECT_TITLE)).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: PROCEED_BUTTON }));
        await user.click(await screen.findByRole("button", { name: /ハイパーボール/ }));
        // 捕獲演出の再生に実時間で2.6秒以上かかり、既定の待機時間 (1000ms) を超えるため延長する。
        expect(
          await screen.findByText(
            spec("やったー！　ピカチュウを　捕まえたぞ！"),
            {},
            { timeout: 4000 },
          ),
        ).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: NEXT_QUEST_BUTTON }));
        await user.click(await screen.findByRole("button", { name: /テスト草原/ }));
        expect(
          await screen.findByText(/A second wild creature\./, {}, { timeout: 3000 }),
        ).toBeInTheDocument();
      });
    });
  });
});

describe("[本体:名前当て]名前当てのヒント", () => {
  function mockQuestForHint() {
    server.use(
      http.get(apiUrl("/quest/new"), () =>
        HttpResponse.json({
          pokemon_id: 25,
          description_en: "A wild creature.",
          is_legendary: false,
          is_mythical: false,
          max_guess_attempts: 3,
        }),
      ),
      http.post(apiUrl("/quest/score"), () =>
        HttpResponse.json({ score: 50, review: "", description_ja: "せつめい" }),
      ),
    );
  }

  describe("名前当ての最大挑戦回数が 3 回で、ヒント要求の応答がタイプ「でんき」と残り挑戦回数 2 回のとき", () => {
    async function pressHintButton() {
      const user = userEvent.setup();
      mockQuestForHint();
      server.use(
        http.post(apiUrl("/quest/hint"), () =>
          HttpResponse.json({ types: ["electric"], attempts_remaining: 2 }),
        ),
      );
      renderWithProviders(<QuestPage />, { withRouter: true });
      await startQuestAndSubmitTranslation(user);

      await user.click(await screen.findByRole("button", { name: HINT_BUTTON }));
    }

    describe("名前当て画面で「ヒントを見る（チャンスを1回使う）」を押すと", () => {
      describe("部品間結合テスト", () => {
        describe("正常系", () => {
          it("出題ポケモンのタイプがでんきのとき、「でんきタイプのポケモンだよ」と表示される", async () => {
            await pressHintButton();

            expect(await screen.findByText("でんきタイプのポケモンだよ")).toBeInTheDocument();
          });

          it("残り挑戦回数が 2 回になる", async () => {
            await pressHintButton();

            await screen.findByText("でんきタイプのポケモンだよ");
            expect(screen.getByRole("meter", { name: "残り挑戦回数" })).toHaveAttribute(
              "aria-valuenow",
              "2",
            );
          });
        });
      });
    });
  });

  describe("名前当ての最大挑戦回数が 3 回で、1 回目のヒント要求の応答がタイプ「でんき」と残り挑戦回数 2 回、2 回目の応答が技「たいあたり」「なきごえ」「でんきショック」と残り挑戦回数 1 回のとき", () => {
    async function pressHintButtonTwice() {
      const user = userEvent.setup();
      let hintCalls = 0;
      mockQuestForHint();
      server.use(
        http.post(apiUrl("/quest/hint"), () => {
          hintCalls++;
          return hintCalls === 1
            ? HttpResponse.json({ types: ["electric"], attempts_remaining: 2 })
            : HttpResponse.json({
                moves: ["たいあたり", "なきごえ", "でんきショック"],
                attempts_remaining: 1,
              });
        }),
      );
      renderWithProviders(<QuestPage />, { withRouter: true });
      await startQuestAndSubmitTranslation(user);

      await user.click(await screen.findByRole("button", { name: HINT_BUTTON }));
      await screen.findByText("でんきタイプのポケモンだよ");

      await user.click(await screen.findByRole("button", { name: HINT_AGAIN_BUTTON }));
    }

    describe("名前当て画面で「ヒントを見る（チャンスを1回使う）」に続けて「別のヒントを見る（チャンスを1回使う）」を押すと", () => {
      describe("部品間結合テスト", () => {
        describe("正常系", () => {
          it("ヒントで返された技「たいあたり」「なきごえ」「でんきショック」が、「「たいあたり」「なきごえ」「でんきショック」を覚えるよ」の形で表示される", async () => {
            await pressHintButtonTwice();

            expect(
              await screen.findByText("「たいあたり」「なきごえ」「でんきショック」を覚えるよ"),
            ).toBeInTheDocument();
          });

          it("残り挑戦回数が 1 回になる", async () => {
            await pressHintButtonTwice();

            await screen.findByText("「たいあたり」「なきごえ」「でんきショック」を覚えるよ");
            expect(screen.getByRole("meter", { name: "残り挑戦回数" })).toHaveAttribute(
              "aria-valuenow",
              "1",
            );
          });
        });
      });
    });
  });

  describe("ヒント要求がサーバーエラー (500) で失敗するとき", () => {
    async function pressHintButtonAfterFailure() {
      const user = userEvent.setup();
      server.use(
        http.post(apiUrl("/quest/hint"), () => HttpResponse.json({}, { status: 500 })),
      );

      renderWithProviders(<QuestPage />, { withRouter: true });
      await startQuestAndSubmitTranslation(user);

      await user.click(await screen.findByRole("button", { name: HINT_BUTTON }));
    }

    describe("名前当て画面で「ヒントを見る（チャンスを1回使う）」を押すと", () => {
      describe("部品間結合テスト", () => {
        describe("異常系", () => {
          it("「ヒントの取得に失敗しました」を含むメッセージが表示される", async () => {
            await pressHintButtonAfterFailure();

            expect(await screen.findByText(/ヒントの取得に失敗しました/)).toBeInTheDocument();
          });

          it("名前当て画面に、「ヒントを見る（チャンスを1回使う）」ボタンが表示されたままになる", async () => {
            await pressHintButtonAfterFailure();

            await screen.findByText(/ヒントの取得に失敗しました/);
            expect(screen.getByRole("button", { name: HINT_BUTTON })).toBeInTheDocument();
          });
        });
      });
    });
  });

  describe("1 回目のヒント要求がサーバーエラー (500) で失敗し、名前当て画面に「ヒントの取得に失敗しました」が表示されているとき", () => {
    async function pressHintButtonAgainAfterFailure(secondResponse: () => Response) {
      const user = userEvent.setup();
      let hintCalls = 0;
      server.use(
        http.post(apiUrl("/quest/hint"), () => {
          hintCalls++;
          return hintCalls === 1 ? HttpResponse.json({}, { status: 500 }) : secondResponse();
        }),
      );

      renderWithProviders(<QuestPage />, { withRouter: true });
      await startQuestAndSubmitTranslation(user);

      await user.click(await screen.findByRole("button", { name: HINT_BUTTON }));
      await screen.findByText(/ヒントの取得に失敗しました/);

      await user.click(screen.getByRole("button", { name: HINT_BUTTON }));
    }

    async function skipNameGuessAfterHintFailure() {
      const user = userEvent.setup();
      server.use(
        http.post(apiUrl("/quest/hint"), () => HttpResponse.json({}, { status: 500 })),
        http.post(apiUrl("/quest/skip-guess"), () => HttpResponse.json({ ball_type: "poke" })),
      );

      renderWithProviders(<QuestPage />, { withRouter: true });
      await startQuestAndSubmitTranslation(user);

      await user.click(await screen.findByRole("button", { name: HINT_BUTTON }));
      await screen.findByText(/ヒントの取得に失敗しました/);

      await user.click(await screen.findByRole("button", { name: SKIP_BUTTON }));
    }

    describe("名前当て画面でもう一度「ヒントを見る（チャンスを1回使う）」を押すと", () => {
      describe("部品間結合テスト", () => {
        describe("異常系", () => {
          it("2 回目のヒント要求の応答がタイプ「でんき」のとき、「でんきタイプのポケモンだよ」が表示される", async () => {
            await pressHintButtonAgainAfterFailure(() =>
              HttpResponse.json({ types: ["electric"], attempts_remaining: 2 }),
            );

            expect(await screen.findByText("でんきタイプのポケモンだよ")).toBeInTheDocument();
          });

          it("2 回目のヒント要求が通信に失敗するとき、「接続できません」を含むメッセージが表示される", async () => {
            await pressHintButtonAgainAfterFailure(() => HttpResponse.error());

            expect(await screen.findByText(/接続できません/)).toBeInTheDocument();
          });

          it.each([
            [
              "2 回目のヒント要求が成功するとき",
              () => HttpResponse.json({ types: ["electric"], attempts_remaining: 2 }),
              "でんきタイプのポケモンだよ",
            ],
            [
              "2 回目のヒント要求が通信に失敗するとき",
              () => HttpResponse.error(),
              "接続できません",
            ],
          ] as const)(
            "%s、「ヒントの取得に失敗しました」が表示されなくなる",
            async (_given, secondResponse, expectedText) => {
              await pressHintButtonAgainAfterFailure(secondResponse);

              await screen.findByText(new RegExp(expectedText));
              expect(screen.queryByText(/ヒントの取得に失敗しました/)).not.toBeInTheDocument();
            },
          );
        });
      });
    });

    describe("名前当て画面で「わからないのでスキップ →」を押すと", () => {
      describe("部品間結合テスト", () => {
        describe("異常系", () => {
          it("捕獲待機画面に「モンスターボールを　手に　入れた！」が表示される", async () => {
            await skipNameGuessAfterHintFailure();

            expect(
              await screen.findByText(/モンスターボール.*手に.*入れた/),
            ).toBeInTheDocument();
          });

          it("捕獲待機画面に進むと、「ヒントの取得に失敗しました」が表示されなくなる", async () => {
            await skipNameGuessAfterHintFailure();

            await screen.findByText(/モンスターボール.*手に.*入れた/);
            expect(screen.queryByText(/ヒントの取得に失敗しました/)).not.toBeInTheDocument();
          });
        });
      });
    });
  });
});

describe("[本体:名前当て]名前当ての判定", () => {
  async function submitNameOnceAfterServerError() {
    const user = userEvent.setup();
    let guessCalls = 0;
    server.use(
      http.post(apiUrl("/quest/guess-name"), () => {
        guessCalls++;
        return guessCalls === 1
          ? HttpResponse.json({}, { status: 500 })
          : HttpResponse.json({ correct: true, ball_type: "ultra", language: "en", attempts_remaining: 2 });
      }),
    );

    renderWithProviders(<QuestPage />, { withRouter: true });
    await startQuestAndSubmitTranslation(user);

    await user.type(await screen.findByRole("textbox"), "Bulbasaur");
    await user.click(screen.getByRole("button", { name: NAME_SUBMIT_BUTTON }));
    return user;
  }

  async function submitNameAgain(user: UserSession) {
    await screen.findByText(/名前の判定に失敗しました/);
    await user.type(screen.getByRole("textbox"), "Bulbasaur");
    await user.click(screen.getByRole("button", { name: NAME_SUBMIT_BUTTON }));
  }

  describe("名前の判定の送信がサーバーエラー (500) で失敗するとき", () => {
    describe("名前当て画面で名前「Bulbasaur」を送信すると", () => {
      describe("部品間結合テスト", () => {
        describe("異常系", () => {
          it("「名前の判定に失敗しました」を含むメッセージが表示される", async () => {
            await submitNameOnceAfterServerError();

            expect(await screen.findByText(/名前の判定に失敗しました/)).toBeInTheDocument();
          });
        });
      });
    });
  });

  describe("名前の判定の 1 回目の送信がサーバーエラー (500) で失敗し、2 回目の送信は英語名として正解と判定されるとき", () => {
    describe("名前当て画面で名前「Bulbasaur」を送信し、続けてもう一度名前「Bulbasaur」を送信すると", () => {
      describe("部品間結合テスト", () => {
        describe("異常系", () => {
          it("「正解！」と表示される", async () => {
            const user = await submitNameOnceAfterServerError();
            await submitNameAgain(user);

            expect(await screen.findByText(CORRECT_TITLE)).toBeInTheDocument();
          });

          it("「名前の判定に失敗しました」が表示されなくなる", async () => {
            const user = await submitNameOnceAfterServerError();
            await submitNameAgain(user);

            await screen.findByText(CORRECT_TITLE);
            expect(screen.queryByText(/名前の判定に失敗しました/)).not.toBeInTheDocument();
          });
        });
      });
    });
  });
});

describe("[本体:クエスト]捕獲に使うボール", () => {
  async function answerNameAndProceed(user: UserSession, name: string): Promise<void> {
    await user.type(await screen.findByRole("textbox"), name);
    await user.click(screen.getByRole("button", { name: NAME_SUBMIT_BUTTON }));
    await user.click(await screen.findByRole("button", { name: PROCEED_BUTTON }));
  }

  function mockCorrectNameGuess(ballType: "great" | "ultra" | "master", language: "ja" | "en") {
    server.use(
      http.post(apiUrl("/quest/guess-name"), () =>
        HttpResponse.json({
          correct: true,
          ball_type: ballType,
          language,
          attempts_remaining: 2,
        }),
      ),
    );
  }

  interface BallCase {
    ballName: string;
    ballType: CaptureResponse["ball_type"];
    prepareNameGuess: () => void;
    answerNameGuess: (user: UserSession) => Promise<void>;
  }

  const SKIPPED_NAME_GUESS: BallCase = {
    ballName: "モンスターボール",
    ballType: "poke",
    prepareNameGuess: () =>
      server.use(
        http.post(apiUrl("/quest/skip-guess"), () => HttpResponse.json({ ball_type: "poke" })),
      ),
    answerNameGuess: async (user) => {
      await user.click(await screen.findByRole("button", { name: SKIP_BUTTON }));
    },
  };

  const CORRECT_JAPANESE_NAME_GUESS: BallCase = {
    ballName: "スーパーボール",
    ballType: "great",
    prepareNameGuess: () => mockCorrectNameGuess("great", "ja"),
    answerNameGuess: (user) => answerNameAndProceed(user, "フシギダネ"),
  };

  const CORRECT_ENGLISH_NAME_GUESS: BallCase = {
    ballName: "ハイパーボール",
    ballType: "ultra",
    prepareNameGuess: () => mockCorrectNameGuess("ultra", "en"),
    answerNameGuess: (user) => answerNameAndProceed(user, "Bulbasaur"),
  };

  const CORRECT_ENGLISH_NAME_GUESS_WITH_MASTER_BALL: BallCase = {
    ballName: "マスターボール",
    ballType: "master",
    prepareNameGuess: () => mockCorrectNameGuess("master", "en"),
    answerNameGuess: (user) => answerNameAndProceed(user, "Bulbasaur"),
  };

  async function expectBallUseButtonShown(ballCase: BallCase) {
    await reachCaptureStandby(ballCase);

    expect(
      await screen.findByRole("button", { name: new RegExp(`${ballCase.ballName}を\\s*使う`) }),
    ).toBeInTheDocument();
  }

  async function expectBallShownInCaptureEffect(ballCase: BallCase) {
    const user = await reachCaptureStandby(ballCase);

    await user.click(await screen.findByRole("button", { name: new RegExp(ballCase.ballName) }));

    expect(await screen.findByAltText(ballCase.ballName)).toBeInTheDocument();
  }

  async function reachCaptureStandby(ballCase: BallCase): Promise<UserSession> {
    const user = userEvent.setup();
    ballCase.prepareNameGuess();
    server.use(
      http.post(apiUrl("/quest/capture"), () =>
        HttpResponse.json({
          captured: true,
          probability: 0.9,
          pokemon_id: 1,
          name_en: "Bulbasaur",
          name_ja: "フシギダネ",
          sprite_url: "https://example.com/1.png",
          score: 80,
          description_en: "x",
          description_ja: "y",
          base_stat_total: 318,
          ball_type: ballCase.ballType,
          types: ["grass", "poison"],
          height: 7,
          weight: 69,
          is_legendary: false,
          is_mythical: false,
        }),
      ),
    );

    renderWithProviders(<QuestPage />, { withRouter: true });
    await startQuestAndSubmitTranslation(user);

    await ballCase.answerNameGuess(user);
    return user;
  }

  describe("翻訳の採点が済み、名前当て画面に進んでいるとき", () => {
    describe("名前当てをスキップしたとき", () => {
      describe("捕獲待機画面に進むと", () => {
        describe("部品間結合テスト", () => {
          describe("正常系", () => {
            it("「モンスターボールを　使う」ボタンが表示される", async () => {
              await expectBallUseButtonShown(SKIPPED_NAME_GUESS);
            });

            it("「モンスターボールを　使う」ボタンを押すと、捕獲演出にモンスターボールが表示される", async () => {
              await expectBallShownInCaptureEffect(SKIPPED_NAME_GUESS);
            });
          });
        });
      });
    });

    describe("日本語名「フシギダネ」を正しく答えたとき", () => {
      describe("捕獲待機画面に進むと", () => {
        describe("部品間結合テスト", () => {
          describe("正常系", () => {
            it("「スーパーボールを　使う」ボタンが表示される", async () => {
              await expectBallUseButtonShown(CORRECT_JAPANESE_NAME_GUESS);
            });

            it("「スーパーボールを　使う」ボタンを押すと、捕獲演出にスーパーボールが表示される", async () => {
              await expectBallShownInCaptureEffect(CORRECT_JAPANESE_NAME_GUESS);
            });
          });
        });
      });
    });

    describe("英語名「Bulbasaur」を正しく答えたとき", () => {
      describe("捕獲待機画面に進むと", () => {
        describe("部品間結合テスト", () => {
          describe("正常系", () => {
            it("「ハイパーボールを　使う」ボタンが表示される", async () => {
              await expectBallUseButtonShown(CORRECT_ENGLISH_NAME_GUESS);
            });

            it("「ハイパーボールを　使う」ボタンを押すと、捕獲演出にハイパーボールが表示される", async () => {
              await expectBallShownInCaptureEffect(CORRECT_ENGLISH_NAME_GUESS);
            });
          });
        });
      });
    });

    describe("英語名「Bulbasaur」を正しく答え、マスターボールが確定したとき", () => {
      describe("捕獲待機画面に進むと", () => {
        describe("部品間結合テスト", () => {
          describe("正常系", () => {
            it("「マスターボールを　使う」ボタンが表示される", async () => {
              await expectBallUseButtonShown(CORRECT_ENGLISH_NAME_GUESS_WITH_MASTER_BALL);
            });

            it("「マスターボールを　使う」ボタンを押すと、捕獲演出にマスターボールが表示される", async () => {
              await expectBallShownInCaptureEffect(CORRECT_ENGLISH_NAME_GUESS_WITH_MASTER_BALL);
            });

            it("博士の「今こそ　このボールを　使うときだ！」が表示される", async () => {
              const user = userEvent.setup();
              mockCorrectNameGuess("master", "en");

              renderWithProviders(<QuestPage />, { withRouter: true });
              await startQuestAndSubmitTranslation(user);
              await answerNameAndProceed(user, "Bulbasaur");

              await waitFor(
                () => {
                  expect(screen.getByText("博士")).toBeVisible();
                  expect(screen.getByText(spec("今こそ　このボールを　使うときだ！"))).toBeVisible();
                },
                { timeout: 2000 },
              );
            });
          });
        });
      });
    });
  });
});

describe("[本体:クエスト]採点中のセッション切れ", () => {
  describe("採点の送信がセッション切れ (404) で失敗するとき", () => {
    describe("場所を選び、翻訳「やくぶん」を送信すると", () => {
      async function submitTranslationAfterSessionExpired() {
        const user = userEvent.setup();
        server.use(
          http.post(apiUrl("/quest/score"), () => HttpResponse.json({}, { status: 404 })),
        );

        renderWithProviders(<QuestPage />, { withRouter: true });
        await startQuestAndSubmitTranslation(user);
        return user;
      }

      describe("部品間結合テスト", () => {
        describe("異常系", () => {
          it("「セッションが切断されました」を含むメッセージが表示される", async () => {
            await submitTranslationAfterSessionExpired();

            expect(await screen.findByText(/セッションが切断されました/)).toBeInTheDocument();
          });

          it("「もう一度探す」を押すと、場所選択画面に「テスト草原」のボタンが表示される", async () => {
            const user = await submitTranslationAfterSessionExpired();
            await screen.findByText(/セッションが切断されました/);

            await user.click(screen.getByRole("button", { name: /もう一度探す/ }));

            expect(
              await screen.findByRole("button", { name: /テスト草原/ }),
            ).toBeInTheDocument();
          });
        });
      });
    });
  });
});

describe("[本体:クエスト]伝説・幻の気配演出", () => {
  describe("場所を選ぶと", () => {
    describe("部品間結合テスト", () => {
      describe("正常系", () => {
        it.each([
          ["出題ポケモンが伝説のとき", 150, true, false],
          ["出題ポケモンが幻のとき", 151, false, true],
        ] as const)("%s、「ただならない　気配を感じる...」と表示される", async (_given, pokemonID, isLegendary, isMythical) => {
          const user = userEvent.setup();
          server.use(
            http.get(apiUrl("/quest/new"), () =>
              HttpResponse.json({
                pokemon_id: pokemonID,
                description_en: "A wild creature.",
                is_legendary: isLegendary,
                is_mythical: isMythical,
                max_guess_attempts: 3,
              }),
            ),
          );

          renderWithProviders(<QuestPage />, { withRouter: true });
          await user.click(await screen.findByRole("button", { name: /テスト草原/ }));

          expect(await screen.findByText(spec("ただならない　気配を感じる..."))).toBeInTheDocument();
        });

        it("出題ポケモンが伝説・幻のどちらでもないとき、「ただならない　気配を感じる...」と表示されない", async () => {
          const user = userEvent.setup();
          server.use(
            http.get(apiUrl("/quest/new"), () =>
              HttpResponse.json({
                pokemon_id: 25,
                description_en: "A wild creature.",
                is_legendary: false,
                is_mythical: false,
                max_guess_attempts: 3,
              }),
            ),
          );

          renderWithProviders(<QuestPage />, { withRouter: true });
          await user.click(await screen.findByRole("button", { name: /テスト草原/ }));
          await screen.findByTestId("quest-description");

          expect(screen.queryByText(spec("ただならない　気配を感じる..."))).not.toBeInTheDocument();
        });
      });
    });
  });
});
