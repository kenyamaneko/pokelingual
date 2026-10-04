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

describe("[クエスト] 場所の選択", () => {
  describe("正常系", () => {
    describe("クエスト画面を開いたとき", () => {
      it("「どこに　ポケモンを　探しに行く？」の見出しが表示される", async () => {
        renderWithProviders(<QuestPage />, { withRouter: true });

        await screen.findByRole("button", { name: /テスト草原/ });
        expect(screen.getByText(spec("どこに ポケモンを 探しに行く？"))).toBeInTheDocument();
      });

      it("場所の選択ボタンが表示される", async () => {
        renderWithProviders(<QuestPage />, { withRouter: true });

        expect(
          await screen.findByRole("button", { name: /テスト草原/ }),
        ).toBeInTheDocument();
      });
    });
  });
});

describe("[クエスト] 出題から捕獲までの一連の流れ", () => {
  describe("正常系", () => {
    it("場所を選んで翻訳を送信し、名前「ピカチュウ」を正しく答えて捕獲に成功したあと、「次のポケモンを探す」を押すと、次の出題の英文が表示される", async () => {
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
          // 入力した名前が伝わることを画面の「正解！」の表示で確かめられるように、一致した名前にだけ正解を返す
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

    it("翻訳を送信して名前当てに進み、「わからないのでスキップ →」を押すと、捕獲待機画面が表示される", async () => {
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
        http.post(apiUrl("/quest/score"), () =>
          HttpResponse.json({ score: 50, review: "", description_ja: "せつめい" }),
        ),
        http.post(apiUrl("/quest/skip-guess"), () => HttpResponse.json({ ball_type: "poke" })),
      );

      renderWithProviders(<QuestPage />, { withRouter: true });

      await startQuestAndSubmitTranslation(user);

      await user.click(await screen.findByRole("button", { name: SKIP_BUTTON }));
      expect(await screen.findByRole("button", { name: /使う/ })).toBeInTheDocument();
    });
  });
});

describe("[クエスト] 名前当てのヒント", () => {
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

  describe("正常系", () => {
    describe("名前当ての最大挑戦回数が 3 回で、「ヒントを見る」を押したとき", () => {
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

    describe("名前当ての最大挑戦回数が 3 回で、「ヒントを見る」に続けて「別のヒントを見る」を押したとき", () => {
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
        expect(await screen.findByText("でんきタイプのポケモンだよ")).toBeInTheDocument();

        await user.click(await screen.findByRole("button", { name: HINT_AGAIN_BUTTON }));
      }

      it("ヒントで返された技の名前が「〜を覚えるよ」の形で表示される", async () => {
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

  describe("異常系", () => {
    describe("ヒントの要求がサーバーエラー (500) で失敗したとき", () => {
      it("「ヒントを見る」を押すと、「ヒントの取得に失敗しました」と表示される", async () => {
        const user = userEvent.setup();
        server.use(
          http.post(apiUrl("/quest/hint"), () => HttpResponse.json({}, { status: 500 })),
        );

        renderWithProviders(<QuestPage />, { withRouter: true });
        await startQuestAndSubmitTranslation(user);

        await user.click(await screen.findByRole("button", { name: HINT_BUTTON }));

        expect(await screen.findByText(/ヒントの取得に失敗しました/)).toBeInTheDocument();
      });

      it("「ヒントを見る」を押しても、名前当て画面のまま「ヒントを見る」ボタンが表示されている", async () => {
        const user = userEvent.setup();
        server.use(
          http.post(apiUrl("/quest/hint"), () => HttpResponse.json({}, { status: 500 })),
        );

        renderWithProviders(<QuestPage />, { withRouter: true });
        await startQuestAndSubmitTranslation(user);

        await user.click(await screen.findByRole("button", { name: HINT_BUTTON }));

        await screen.findByText(/ヒントの取得に失敗しました/);
        expect(screen.getByRole("button", { name: HINT_BUTTON })).toBeInTheDocument();
      });

      it("出題ポケモンのタイプがでんきのとき、もう一度「ヒントを見る」を押して成功すると、「でんきタイプのポケモンだよ」が表示され、「ヒントの取得に失敗しました」が消える", async () => {
        const user = userEvent.setup();
        let hintCalls = 0;
        server.use(
          http.post(apiUrl("/quest/hint"), () => {
            hintCalls++;
            return hintCalls === 1
              ? HttpResponse.json({}, { status: 500 })
              : HttpResponse.json({ types: ["electric"], attempts_remaining: 2 });
          }),
        );

        renderWithProviders(<QuestPage />, { withRouter: true });
        await startQuestAndSubmitTranslation(user);

        await user.click(await screen.findByRole("button", { name: HINT_BUTTON }));
        expect(await screen.findByText(/ヒントの取得に失敗しました/)).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: HINT_BUTTON }));

        expect(await screen.findByText("でんきタイプのポケモンだよ")).toBeInTheDocument();
        expect(screen.queryByText(/ヒントの取得に失敗しました/)).not.toBeInTheDocument();
      });

      it("名前当てをスキップして捕獲待機画面に進むと、「ヒントの取得に失敗しました」が表示されなくなる", async () => {
        const user = userEvent.setup();
        server.use(
          http.post(apiUrl("/quest/hint"), () => HttpResponse.json({}, { status: 500 })),
          http.post(apiUrl("/quest/skip-guess"), () => HttpResponse.json({ ball_type: "poke" })),
        );

        renderWithProviders(<QuestPage />, { withRouter: true });
        await startQuestAndSubmitTranslation(user);

        await user.click(await screen.findByRole("button", { name: HINT_BUTTON }));
        expect(await screen.findByText(/ヒントの取得に失敗しました/)).toBeInTheDocument();

        await user.click(await screen.findByRole("button", { name: SKIP_BUTTON }));

        expect(
          await screen.findByText(/モンスターボール.*手に.*入れた/),
        ).toBeInTheDocument();
        expect(screen.queryByText(/ヒントの取得に失敗しました/)).not.toBeInTheDocument();
      });

      it("もう一度「ヒントを見る」を押して今度は通信に失敗すると、メッセージが「接続できません」を含むものに切り替わり、「ヒントの取得に失敗しました」が消える", async () => {
        const user = userEvent.setup();
        let hintCalls = 0;
        server.use(
          http.post(apiUrl("/quest/hint"), () => {
            hintCalls++;
            return hintCalls === 1
              ? HttpResponse.json({}, { status: 500 })
              : HttpResponse.error();
          }),
        );

        renderWithProviders(<QuestPage />, { withRouter: true });
        await startQuestAndSubmitTranslation(user);

        await user.click(await screen.findByRole("button", { name: HINT_BUTTON }));
        expect(await screen.findByText(/ヒントの取得に失敗しました/)).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: HINT_BUTTON }));

        expect(await screen.findByText(/接続できません/)).toBeInTheDocument();
        expect(screen.queryByText(/ヒントの取得に失敗しました/)).not.toBeInTheDocument();
      });
    });
  });
});

describe("[クエスト] 名前当ての判定", () => {
  describe("異常系", () => {
    it("名前の判定の送信がサーバーエラー (500) で失敗したあと、もう一度名前を送信して正解すると、「正解！」と表示され、「名前の判定に失敗しました」が消える", async () => {
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
      expect(await screen.findByText(/名前の判定に失敗しました/)).toBeInTheDocument();

      await user.type(screen.getByRole("textbox"), "Bulbasaur");
      await user.click(screen.getByRole("button", { name: NAME_SUBMIT_BUTTON }));

      expect(await screen.findByText(CORRECT_TITLE)).toBeInTheDocument();
      expect(screen.queryByText(/名前の判定に失敗しました/)).not.toBeInTheDocument();
    });
  });
});

describe("[クエスト] 捕獲に使うボール", () => {
  describe("正常系", () => {
    it.each([
      [
        "名前当てをスキップした",
        "モンスターボール",
        "poke",
        () =>
          server.use(
            http.post(apiUrl("/quest/skip-guess"), () => HttpResponse.json({ ball_type: "poke" })),
          ),
        async (user: UserSession) => {
          await user.click(await screen.findByRole("button", { name: SKIP_BUTTON }));
        },
      ],
      [
        "日本語名を正しく当てた",
        "スーパーボール",
        "great",
        () =>
          server.use(
            http.post(apiUrl("/quest/guess-name"), () =>
              HttpResponse.json({
                correct: true,
                ball_type: "great",
                language: "ja",
                attempts_remaining: 2,
              }),
            ),
          ),
        async (user: UserSession) => {
          await user.type(await screen.findByRole("textbox"), "フシギダネ");
          await user.click(screen.getByRole("button", { name: NAME_SUBMIT_BUTTON }));
          await user.click(await screen.findByRole("button", { name: PROCEED_BUTTON }));
        },
      ],
      [
        "英語名を正しく当てた",
        "ハイパーボール",
        "ultra",
        () =>
          server.use(
            http.post(apiUrl("/quest/guess-name"), () =>
              HttpResponse.json({
                correct: true,
                ball_type: "ultra",
                language: "en",
                attempts_remaining: 2,
              }),
            ),
          ),
        async (user: UserSession) => {
          await user.type(await screen.findByRole("textbox"), "Bulbasaur");
          await user.click(screen.getByRole("button", { name: NAME_SUBMIT_BUTTON }));
          await user.click(await screen.findByRole("button", { name: PROCEED_BUTTON }));
        },
      ],
      [
        "名前当てでマスターボールが確定した",
        "マスターボール",
        "master",
        () =>
          server.use(
            http.post(apiUrl("/quest/guess-name"), () =>
              HttpResponse.json({
                correct: true,
                ball_type: "master",
                language: "en",
                attempts_remaining: 2,
              }),
            ),
          ),
        async (user: UserSession) => {
          await user.type(await screen.findByRole("textbox"), "Bulbasaur");
          await user.click(screen.getByRole("button", { name: NAME_SUBMIT_BUTTON }));
          await user.click(await screen.findByRole("button", { name: PROCEED_BUTTON }));
        },
      ],
    ] as const)(
      "%sとき、捕獲待機画面と捕獲演出の両方で%sが表示される",
      async (_trigger, ballName, ballType, setupGuessHandler, performGuess) => {
        const user = userEvent.setup();
        setupGuessHandler();
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
              ball_type: ballType,
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

        await performGuess(user);

        await user.click(
          await screen.findByRole("button", { name: new RegExp(ballName) }),
        );

        expect(await screen.findByAltText(ballName)).toBeInTheDocument();
      },
    );

    it("名前当てでマスターボールが確定したとき、捕獲待機画面に博士の「今こそ　このボールを　使うときだ！」が吹き出しで表示される", async () => {
      const user = userEvent.setup();
      server.use(
        http.post(apiUrl("/quest/guess-name"), () =>
          HttpResponse.json({
            correct: true,
            ball_type: "master",
            language: "en",
            attempts_remaining: 2,
          }),
        ),
      );

      renderWithProviders(<QuestPage />, { withRouter: true });
      await startQuestAndSubmitTranslation(user);
      await user.type(await screen.findByRole("textbox"), "Bulbasaur");
      await user.click(screen.getByRole("button", { name: NAME_SUBMIT_BUTTON }));
      await user.click(await screen.findByRole("button", { name: PROCEED_BUTTON }));

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

describe("[クエスト] 採点中のセッション切れ", () => {
  describe("異常系", () => {
    describe("採点の送信がセッション切れ (404) で失敗したとき", () => {
      function mockScoreSessionExpired() {
        server.use(
          http.post(apiUrl("/quest/score"), () => HttpResponse.json({}, { status: 404 })),
        );
      }

      it("「セッションが切断されました」を含むメッセージが表示される", async () => {
        const user = userEvent.setup();
        mockScoreSessionExpired();

        renderWithProviders(<QuestPage />, { withRouter: true });
        await startQuestAndSubmitTranslation(user);

        expect(await screen.findByText(/セッションが切断されました/)).toBeInTheDocument();
      });

      it("「もう一度探す」を押すと、場所の選択画面が表示される", async () => {
        const user = userEvent.setup();
        mockScoreSessionExpired();

        renderWithProviders(<QuestPage />, { withRouter: true });
        await startQuestAndSubmitTranslation(user);
        await screen.findByText(/セッションが切断されました/);

        await user.click(screen.getByRole("button", { name: /もう一度探す/ }));

        expect(
          await screen.findByRole("button", { name: /テスト草原/ }),
        ).toBeInTheDocument();
      });
    });
  });
});

describe("[クエスト] 伝説・幻の気配演出", () => {
  describe("正常系", () => {
    it.each([
      ["伝説", 150, true, false],
      ["幻", 151, false, true],
    ] as const)("出題ポケモンが%sのとき、「ただならない　気配を感じる...」と表示される", async (
      _kind,
      pokemonID,
      isLegendary,
      isMythical,
    ) => {
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
