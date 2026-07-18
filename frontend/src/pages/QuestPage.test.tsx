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
      pokemon_id: 9001,
      name_en: "Testmon",
      name_ja: "テストモン",
      sprite_url: "https://example.com/9001.png",
      score: 80,
      description_en: "Testmon is fast.",
      description_ja: "テストモンは はやい。",
      base_stat_total: 300,
      ball_type: "ultra",
      types: ["normal"],
      height: 1,
      weight: 1,
      is_legendary: false,
      is_mythical: false,
    };
    server.use(
      http.get(apiUrl("/quest/new"), () => {
        newQuestCall += 1;
        return HttpResponse.json({
          pokemon_id: newQuestCall === 1 ? 9001 : 9002,
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
          guess === "テストモン"
            ? { correct: true, ball_type: "ultra", language: "ja", attempts_remaining: 2 }
            : { correct: false, attempts_remaining: 2 },
        );
      }),
      http.post(apiUrl("/quest/capture"), () => HttpResponse.json(captured)),
    );

    renderWithProviders(<QuestPage />, { withRouter: true });

    await user.click(await screen.findByRole("button", { name: /テスト草原/ }));

    const translationBox = await screen.findByRole("textbox");
    await waitFor(() =>
      expect(screen.getByTestId("quest-description")).toHaveTextContent(
        "The first wild creature.",
      ),
    );

    await user.type(translationBox, "さいしょのやくぶん");
    await user.click(
      screen.getByRole("button", { name: TRANSLATION_INPUT_LABELS.submitButton }),
    );
    expect(await screen.findByText("さいしょのやくぶん")).toBeInTheDocument();

    await user.type(screen.getByRole("textbox"), "テストモン");
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
        spec(CAPTURE_RESULT_LABELS.capturedTitle("テストモン")),
        {},
        { timeout: 4000 },
      ),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: CAPTURE_RESULT_LABELS.nextButton }),
    );
    await user.click(await screen.findByRole("button", { name: /テスト草原/ }));
    await waitFor(() =>
      expect(screen.getByTestId("quest-description")).toHaveTextContent(
        "A second wild creature.",
      ),
    );
  });

  it("翻訳後に名前当てをスキップすると、捕獲画面へ進む", async () => {
    const user = userEvent.setup();
    server.use(
      http.get(apiUrl("/quest/new"), () =>
        HttpResponse.json({
          pokemon_id: 9001,
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
          pokemon_id: 9001,
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
        await user.type(await screen.findByRole("textbox"), "テストモン");
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
        await user.type(await screen.findByRole("textbox"), "Testmon");
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
        await user.type(await screen.findByRole("textbox"), "Testmon");
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
            pokemon_id: 9001,
            name_en: "Testmon",
            name_ja: "テストモン",
            sprite_url: "https://example.com/9001.png",
            score: 80,
            description_en: "x",
            description_ja: "y",
            base_stat_total: 300,
            ball_type: ballType,
            types: ["normal"],
            height: 1,
            weight: 1,
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
    await user.type(await screen.findByRole("textbox"), "Testmon");
    await user.click(
      screen.getByRole("button", { name: POKEMON_NAME_INPUT_LABELS.submitButton }),
    );
    await user.click(
      await screen.findByRole("button", { name: NAME_GUESS_LABELS.proceedButton }),
    );

    await waitFor(
      () => {
        expect(screen.getByText("博士")).toBeVisible();
        expect(screen.getByText(spec("今こそ　このボールを　使うときだ！"), { exact: false })).toBeVisible();
      },
      { timeout: 2000 },
    );
    expect(screen.getByText(spec("（なんと　マスターボールを手に入れた）"), { exact: false })).toBeVisible();
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
