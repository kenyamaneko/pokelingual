import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { QuestPage } from "./QuestPage";
import { renderWithProviders } from "../test/render";
import { server, apiUrl } from "../test/mswServer";
import { spec } from "../test/labels";
import { TRANSLATION_INPUT_LABELS } from "../components/quest/TranslationInput";
import { NAME_GUESS_LABELS } from "../components/quest/NameGuess";
import { POKEMON_NAME_INPUT_LABELS } from "../components/quest/PokemonNameInput";
import { CAPTURE_RESULT_LABELS } from "../components/quest/CaptureResult";
import { BALL_NAMES } from "../components/quest/ballAssets";
import type { CaptureResponse } from "../../../shared/api-types/quest";

/**
 * クエストの正常系フロー (公開入口 = QuestPage から一気通貫):
 * 翻訳の送信 → 採点 → 名前当て / スキップ → 捕獲 → 次の出題までを、フェーズごとに
 * 画面に出る結果で確かめる。API 境界 (HTTP) だけ MSW で差し替え、QuestPage / useQuest /
 * questApi / 各コンポーネントは本物を通す。
 *
 * 末端コンポーネントの操作→効果 (翻訳訳が渡る・推測名が渡る・スキップで捕獲へ進む・
 * 「つぎの ぼうけんへ」で次の出題へ) は、単体でモック呼び出しを見るのではなく、ここで
 * 実際に画面が切り替わる結果として確かめる。ダミーの出題データを用いる。
 */
describe("[クエスト] クエストの正常系フロー (公開入口経由)", () => {
  it("翻訳→名前当て→捕獲と進み、「次のポケモンを探す」で次の出題が始まる", async () => {
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
        // 実バックエンド同様、一致した推測名にだけ正解を返す。これで画面の「せいかい」表示が
        // 入力名の伝達を裏づけ、モック呼び出し自体は検証せずに済む。
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
    await user.click(
      screen.getByRole("button", { name: TRANSLATION_INPUT_LABELS.submitButton }),
    );
    expect(await screen.findByText("さいしょのやくぶん")).toBeInTheDocument();

    await user.type(screen.getByRole("textbox"), "ピカチュウ");
    await user.click(
      screen.getByRole("button", { name: POKEMON_NAME_INPUT_LABELS.submitButton }),
    );
    expect(await screen.findByText(spec(NAME_GUESS_LABELS.correctTitle))).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: NAME_GUESS_LABELS.proceedButton }),
    );
    await user.click(await screen.findByRole("button", { name: /ハイパーボール/ }));
    // 捕獲演出の再生に実時間で2.6秒以上かかり、既定の待機時間 (1000ms) を超えるため延長する。
    expect(
      await screen.findByText(
        spec(CAPTURE_RESULT_LABELS.capturedTitle("ピカチュウ")),
        {},
        { timeout: 4000 },
      ),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: CAPTURE_RESULT_LABELS.nextButton }),
    );
    await user.click(await screen.findByRole("button", { name: /テスト草原/ }));
    await screen.findByText(/A second wild creature\./, {}, { timeout: 3000 });
  });

  it("翻訳後に名前当てをスキップすると、捕獲画面へ進む", async () => {
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

    await user.click(await screen.findByRole("button", { name: /テスト草原/ }));

    await user.type(await screen.findByRole("textbox"), "やくぶん");
    await user.click(
      screen.getByRole("button", { name: TRANSLATION_INPUT_LABELS.submitButton }),
    );

    await user.click(
      await screen.findByRole("button", { name: NAME_GUESS_LABELS.skipButton }),
    );
    expect(await screen.findByRole("button", { name: /使う/ })).toBeInTheDocument();
  });

  it("名前当てでヒントを要求すると、出題ポケモンのタイプが表示され残り回数が減る", async () => {
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
      http.post(apiUrl("/quest/hint"), () =>
        HttpResponse.json({ types: ["electric"], attempts_remaining: 2 }),
      ),
    );

    renderWithProviders(<QuestPage />, { withRouter: true });

    await user.click(await screen.findByRole("button", { name: /テスト草原/ }));
    await user.type(await screen.findByRole("textbox"), "やくぶん");
    await user.click(
      screen.getByRole("button", { name: TRANSLATION_INPUT_LABELS.submitButton }),
    );

    await user.click(
      await screen.findByRole("button", { name: NAME_GUESS_LABELS.hintButton }),
    );

    expect(await screen.findByText("でんきタイプのポケモンだよ")).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "残り挑戦回数" })).toHaveAttribute("aria-valuenow", "2");
  });

  it("名前当てで2回ヒントを要求すると、技の一覧も表示され残り回数がさらに減る", async () => {
    const user = userEvent.setup();
    let hintCalls = 0;
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

    await user.click(await screen.findByRole("button", { name: /テスト草原/ }));
    await user.type(await screen.findByRole("textbox"), "やくぶん");
    await user.click(
      screen.getByRole("button", { name: TRANSLATION_INPUT_LABELS.submitButton }),
    );

    await user.click(
      await screen.findByRole("button", { name: NAME_GUESS_LABELS.hintButton }),
    );
    expect(await screen.findByText("でんきタイプのポケモンだよ")).toBeInTheDocument();

    await user.click(
      await screen.findByRole("button", { name: NAME_GUESS_LABELS.hintButtonAgain }),
    );

    expect(
      await screen.findByText("「たいあたり」「なきごえ」「でんきショック」を覚えるよ"),
    ).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "残り挑戦回数" })).toHaveAttribute("aria-valuenow", "1");
  });

  it.each([
    [
      "名前当てをスキップしたとき、捕獲画面と捕獲演出の両方でモンスターボールになる",
      "poke",
      "モンスターボール",
      () =>
        server.use(
          http.post(apiUrl("/quest/skip-guess"), () => HttpResponse.json({ ball_type: "poke" })),
        ),
      async (user: ReturnType<typeof userEvent.setup>) => {
        await user.click(
          await screen.findByRole("button", { name: NAME_GUESS_LABELS.skipButton }),
        );
      },
    ],
    [
      "日本語名を正しく当てたとき、捕獲画面と捕獲演出の両方でスーパーボールになる",
      "great",
      "スーパーボール",
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
      async (user: ReturnType<typeof userEvent.setup>) => {
        await user.type(await screen.findByRole("textbox"), "フシギダネ");
        await user.click(
          screen.getByRole("button", { name: POKEMON_NAME_INPUT_LABELS.submitButton }),
        );
        await user.click(
          await screen.findByRole("button", { name: NAME_GUESS_LABELS.proceedButton }),
        );
      },
    ],
    [
      "英語名を正しく当てたとき、捕獲画面と捕獲演出の両方でハイパーボールになる",
      "ultra",
      "ハイパーボール",
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
      async (user: ReturnType<typeof userEvent.setup>) => {
        await user.type(await screen.findByRole("textbox"), "Bulbasaur");
        await user.click(
          screen.getByRole("button", { name: POKEMON_NAME_INPUT_LABELS.submitButton }),
        );
        await user.click(
          await screen.findByRole("button", { name: NAME_GUESS_LABELS.proceedButton }),
        );
      },
    ],
    [
      "名前当てでマスターボールが確定したとき、捕獲画面と捕獲演出の両方でマスターボールになる",
      "master",
      "マスターボール",
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
      async (user: ReturnType<typeof userEvent.setup>) => {
        await user.type(await screen.findByRole("textbox"), "Bulbasaur");
        await user.click(
          screen.getByRole("button", { name: POKEMON_NAME_INPUT_LABELS.submitButton }),
        );
        await user.click(
          await screen.findByRole("button", { name: NAME_GUESS_LABELS.proceedButton }),
        );
      },
    ],
  ] as const)(
    "%s",
    async (_name, ballType, ballName, setupGuessHandler, performGuess) => {
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
      await user.click(await screen.findByRole("button", { name: /テスト草原/ }));
      await user.type(await screen.findByRole("textbox"), "やくぶん");
      await user.click(
        screen.getByRole("button", { name: TRANSLATION_INPUT_LABELS.submitButton }),
      );

      await performGuess(user);

      await user.click(
        await screen.findByRole("button", { name: new RegExp(ballName) }),
      );

      expect(await screen.findByAltText(ballName)).toBeInTheDocument();
    },
  );

  it("マスターボール確定時、捕獲待機画面に博士のセリフが吹き出しで表示される", async () => {
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
    await user.click(await screen.findByRole("button", { name: /テスト草原/ }));
    await user.type(await screen.findByRole("textbox"), "やくぶん");
    await user.click(
      screen.getByRole("button", { name: TRANSLATION_INPUT_LABELS.submitButton }),
    );
    await user.type(await screen.findByRole("textbox"), "Bulbasaur");
    await user.click(
      screen.getByRole("button", { name: POKEMON_NAME_INPUT_LABELS.submitButton }),
    );
    await user.click(
      await screen.findByRole("button", { name: NAME_GUESS_LABELS.proceedButton }),
    );

    await waitFor(
      () => {
        expect(screen.getByText("博士")).toBeVisible();
        expect(screen.getByText(spec("今こそ　このボールを　使うときだ！"))).toBeVisible();
      },
      { timeout: 2000 },
    );
  });

  it("最初に場所選択画面が表示される", async () => {
    renderWithProviders(<QuestPage />, { withRouter: true });

    expect(
      await screen.findByRole("button", { name: /テスト草原/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(spec("どこに ポケモンを 探しに行く？"))).toBeInTheDocument();
  });

  it("採点中にセッションが切れる (404) と、もう一度探す導線が出る", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(apiUrl("/quest/score"), () => HttpResponse.json({}, { status: 404 })),
    );

    renderWithProviders(<QuestPage />, { withRouter: true });
    await user.click(await screen.findByRole("button", { name: /テスト草原/ }));
    await user.type(await screen.findByRole("textbox"), "やくぶん");
    await user.click(
      screen.getByRole("button", { name: TRANSLATION_INPUT_LABELS.submitButton }),
    );

    expect(await screen.findByText(/セッションが切断されました/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /もう一度探す/ }));

    expect(
      await screen.findByRole("button", { name: /テスト草原/ }),
    ).toBeInTheDocument();
  });
});

describe("[クエスト] 進行中のエラー表示", () => {
  it("ヒント要求が失敗しても、名前当て画面のままエラーメッセージが表示される", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(apiUrl("/quest/hint"), () => HttpResponse.json({}, { status: 500 })),
    );

    renderWithProviders(<QuestPage />, { withRouter: true });
    await user.click(await screen.findByRole("button", { name: /テスト草原/ }));
    await user.type(await screen.findByRole("textbox"), "やくぶん");
    await user.click(
      screen.getByRole("button", { name: TRANSLATION_INPUT_LABELS.submitButton }),
    );

    await user.click(
      await screen.findByRole("button", { name: NAME_GUESS_LABELS.hintButton }),
    );

    expect(await screen.findByText(/ヒントの取得に失敗しました/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: NAME_GUESS_LABELS.hintButton }),
    ).toBeInTheDocument();
  });

  it("ヒント要求の失敗後に再度ヒントを要求すると、エラーメッセージは消える", async () => {
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
    await user.click(await screen.findByRole("button", { name: /テスト草原/ }));
    await user.type(await screen.findByRole("textbox"), "やくぶん");
    await user.click(
      screen.getByRole("button", { name: TRANSLATION_INPUT_LABELS.submitButton }),
    );

    await user.click(
      await screen.findByRole("button", { name: NAME_GUESS_LABELS.hintButton }),
    );
    expect(await screen.findByText(/ヒントの取得に失敗しました/)).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: NAME_GUESS_LABELS.hintButton }),
    );

    expect(await screen.findByText("でんきタイプのポケモンだよ")).toBeInTheDocument();
    expect(screen.queryByText(/ヒントの取得に失敗しました/)).not.toBeInTheDocument();
  });

  it("ヒント要求が失敗した後に名前当てをスキップして捕獲画面へ進むと、エラーメッセージは残らない", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(apiUrl("/quest/hint"), () => HttpResponse.json({}, { status: 500 })),
      http.post(apiUrl("/quest/skip-guess"), () => HttpResponse.json({ ball_type: "poke" })),
    );

    renderWithProviders(<QuestPage />, { withRouter: true });
    await user.click(await screen.findByRole("button", { name: /テスト草原/ }));
    await user.type(await screen.findByRole("textbox"), "やくぶん");
    await user.click(
      screen.getByRole("button", { name: TRANSLATION_INPUT_LABELS.submitButton }),
    );

    await user.click(
      await screen.findByRole("button", { name: NAME_GUESS_LABELS.hintButton }),
    );
    expect(await screen.findByText(/ヒントの取得に失敗しました/)).toBeInTheDocument();

    await user.click(
      await screen.findByRole("button", { name: NAME_GUESS_LABELS.skipButton }),
    );

    expect(
      await screen.findByText(new RegExp(`${BALL_NAMES.poke}.*手に.*入れた`)),
    ).toBeInTheDocument();
    expect(screen.queryByText(/ヒントの取得に失敗しました/)).not.toBeInTheDocument();
  });

  it("名前当てが失敗しても入力欄は維持され、再送信して正解するとエラーメッセージが消える", async () => {
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
    await user.click(await screen.findByRole("button", { name: /テスト草原/ }));
    await user.type(await screen.findByRole("textbox"), "やくぶん");
    await user.click(
      screen.getByRole("button", { name: TRANSLATION_INPUT_LABELS.submitButton }),
    );

    await user.type(await screen.findByRole("textbox"), "Bulbasaur");
    await user.click(
      screen.getByRole("button", { name: POKEMON_NAME_INPUT_LABELS.submitButton }),
    );
    expect(await screen.findByText(/名前の判定に失敗しました/)).toBeInTheDocument();

    await user.type(screen.getByRole("textbox"), "Bulbasaur");
    await user.click(
      screen.getByRole("button", { name: POKEMON_NAME_INPUT_LABELS.submitButton }),
    );

    expect(await screen.findByText(spec(NAME_GUESS_LABELS.correctTitle))).toBeInTheDocument();
    expect(screen.queryByText(/名前の判定に失敗しました/)).not.toBeInTheDocument();
  });

  it("ヒント要求が1回目は5xx、2回目はネットワーク接続失敗で連続して失敗すると、エラーメッセージは接続エラーの案内に切り替わる", async () => {
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
    await user.click(await screen.findByRole("button", { name: /テスト草原/ }));
    await user.type(await screen.findByRole("textbox"), "やくぶん");
    await user.click(
      screen.getByRole("button", { name: TRANSLATION_INPUT_LABELS.submitButton }),
    );

    await user.click(
      await screen.findByRole("button", { name: NAME_GUESS_LABELS.hintButton }),
    );
    expect(await screen.findByText(/ヒントの取得に失敗しました/)).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: NAME_GUESS_LABELS.hintButton }),
    );

    expect(await screen.findByText(/接続できません/)).toBeInTheDocument();
    expect(screen.queryByText(/ヒントの取得に失敗しました/)).not.toBeInTheDocument();
  });
});

describe("[クエスト] 伝説・幻の気配演出", () => {
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

  it("出題ポケモンが伝説・幻のどちらでもないとき、「ただならない　気配を感じる...」は表示されない", async () => {
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
