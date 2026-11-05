import { screen, waitFor, render } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { describe, expect } from "vitest";
import type { User } from "firebase/auth";
import App from "../../App";
import { TutorialPage } from "../../pages/TutorialPage";
import { renderWithProviders } from "../../test/render";
import { spec } from "../../test/labels";
import { defineCase } from "../../test/defineCase";

const fakeUser = { uid: "trainer-test" } as unknown as User;

const START_QUEST_BUTTON = "ポケモンを探しに行く";
const INTRO_DISMISS_BUTTON = "はじめる";
const TRANSLATION_SUBMIT_BUTTON = "この翻訳に決めた！";
const NAME_PLACEHOLDER = "ポケモンの名前を入力してね";
const NAME_SUBMIT_BUTTON = "君に　決めた！";
const NAME_PROCEED_BUTTON = "次へ進む";
const HINT_BUTTON = "ヒントを見る（チャンスを1回使う）";
const BACK_TO_MENU_BUTTON = "メニューに戻る";

const ULTRA_BALL_USE_BUTTON = "ハイパーボールを　使う";
const GREAT_BALL_USE_BUTTON = "スーパーボールを　使う";

/**
 * チュートリアルを描画し、開始時の遊び方説明モーダルを閉じて操作可能な状態にする。
 * @returns 操作継続に使う userEvent インスタンス。
 */
async function renderTutorialPastIntro(): Promise<UserEvent> {
  const user = userEvent.setup();
  renderWithProviders(<TutorialPage />, { user: fakeUser, withRouter: true });
  await user.click(await screen.findByRole("button", { name: INTRO_DISMISS_BUTTON }));
  return user;
}

/**
 * 翻訳を入力して送信する。
 * @param user userEvent インスタンス。
 * @param translation 送信する翻訳。
 */
async function fillAndSubmitTranslation(user: UserEvent, translation: string): Promise<void> {
  await user.type(await screen.findByRole("textbox"), translation);
  await user.click(screen.getByRole("button", { name: TRANSLATION_SUBMIT_BUTTON }));
}

/**
 * 名前を入力して送信する。
 * @param user userEvent インスタンス。
 * @param name 送信する名前。
 */
async function fillAndSubmitName(user: UserEvent, name: string): Promise<void> {
  await user.type(await screen.findByPlaceholderText(NAME_PLACEHOLDER), name);
  await user.click(screen.getByRole("button", { name: NAME_SUBMIT_BUTTON }));
}

/**
 * 遊び方説明を閉じ、英文当てステップを突破してポケモン名当てステップまで進める。
 * @returns 操作継続に使う userEvent インスタンス。
 */
async function proceedToNameStep(): Promise<UserEvent> {
  const user = await renderTutorialPastIntro();
  await fillAndSubmitTranslation(user, "電気タイプのねずみポケモン");
  await screen.findByPlaceholderText(NAME_PLACEHOLDER);
  return user;
}

/**
 * ポケモン名当てで正解し、ボールを使って結果画面まで到達させる。
 * @returns 操作継続に使う userEvent インスタンス。
 */
async function completeTutorial(): Promise<UserEvent> {
  const user = await proceedToNameStep();
  await fillAndSubmitName(user, "pikachu");
  await user.click(await screen.findByRole("button", { name: NAME_PROCEED_BUTTON }));
  await user.click(await screen.findByRole("button", { name: ULTRA_BALL_USE_BUTTON }));
  return user;
}

const OPEN_TUTORIAL = "遊び方の説明を表示するために、チュートリアル画面を開く";
const PRESS_INTRO_DISMISS = "チュートリアル画面の遊び方の説明モーダルで、「はじめる」を押す";
const SUBMIT_TRANSLATION = "チュートリアル画面の英文当てステップで、翻訳「電気タイプのねずみポケモン」を送信する";
const TRANSLATION_WITHOUT_ELECTRIC = "英文当てステップに入力する翻訳が、「電気」を含まない「ねずみポケモン」であるとき";
const SUBMIT_TRANSLATION_ANY = "チュートリアル画面の英文当てステップで、翻訳を送信する";
const NAME_OTHER_THAN_PIKACHU = "ポケモン名当てステップに入力する名前が、ピカチュウ以外の「raichu」であるとき";
const SUBMIT_NAME_ANY = "チュートリアル画面のポケモン名当てステップで、名前を送信する";
const PRESS_PROCEED = "チュートリアル画面のポケモン名当てステップで、「次へ進む」を押す";
const SHAKE_GUIDE_BUBBLE = "案内の吹き出しが揺れる";

describe("[本体:チュートリアル]遊び方の説明", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          When: [OPEN_TUTORIAL],
          Then: "遊び方の説明モーダルに「遊び方の説明をします」と「吹き出しの指示に従って文字を入力してみてね」が表示される",
        },
      ],
    },
    async () => {
      renderWithProviders(<TutorialPage />, { user: fakeUser, withRouter: true });

      await screen.findByRole("dialog");
      expect(screen.getByText("遊び方の説明をします")).toBeInTheDocument();
      expect(screen.getByText("吹き出しの指示に従って文字を入力してみてね")).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "遊び方の説明モーダルが表示されているとき",
          When: [PRESS_INTRO_DISMISS],
          Then: "遊び方の説明モーダルが画面から消える",
        },
      ],
    },
    async () => {
      const user = userEvent.setup();
      renderWithProviders(<TutorialPage />, { user: fakeUser, withRouter: true });

      await user.click(await screen.findByRole("button", { name: INTRO_DISMISS_BUTTON }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    },
  );
});

describe("[本体:チュートリアル]英文当てステップ", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          When: [OPEN_TUTORIAL, PRESS_INTRO_DISMISS],
          Then: "英文「It is an Electric-type Mouse Pokémon.」が表示される",
        },
      ],
    },
    async () => {
      await renderTutorialPastIntro();

      // タイプライター演出で全文表示まで実時間がかかるため、既定の待機時間 (1000ms) を延長する。
      expect(
        await screen.findByText(/It is an Electric-type Mouse Pokémon\./, {}, { timeout: 3000 }),
      ).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          When: [OPEN_TUTORIAL, PRESS_INTRO_DISMISS],
          Then: "吹き出しにタイトル「この英文を訳してみよう」と案内文「「電気タイプのねずみポケモン」と入力してみてね」が表示される",
        },
      ],
    },
    async () => {
      await renderTutorialPastIntro();

      await waitFor(() => {
        expect(screen.getByText(spec("「電気タイプのねずみポケモン」と入力してみてね"))).toBeVisible();
      });
      expect(screen.getByText("この英文を訳してみよう")).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          When: [
            OPEN_TUTORIAL,
            PRESS_INTRO_DISMISS,
            "チュートリアル画面の英文当てステップで、「電気」と「ねずみ」を両方含む翻訳「電気タイプのねずみポケモン」を送信する",
          ],
          Then: "最終評価点が上限の 99% と表示される",
        },
      ],
    },
    async () => {
      const user = await renderTutorialPastIntro();

      await fillAndSubmitTranslation(user, "電気タイプのねずみポケモン");

      expect(await screen.findByText("99%", {}, { timeout: 3000 })).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: TRANSLATION_WITHOUT_ELECTRIC,
          When: [OPEN_TUTORIAL, PRESS_INTRO_DISMISS, SUBMIT_TRANSLATION_ANY],
          Then: "採点結果画面に進まず、翻訳の入力欄が表示されたままになる",
        },
      ],
    },
    async () => {
      const user = await renderTutorialPastIntro();

      await fillAndSubmitTranslation(user, "ねずみポケモン");

      expect(screen.getByRole("textbox")).toBeInTheDocument();
      expect(screen.queryByTestId("damage-value")).not.toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: TRANSLATION_WITHOUT_ELECTRIC,
          When: [OPEN_TUTORIAL, PRESS_INTRO_DISMISS, SUBMIT_TRANSLATION_ANY],
          Then: SHAKE_GUIDE_BUBBLE,
        },
      ],
    },
    async () => {
      const user = await renderTutorialPastIntro();
      await waitFor(() => expect(screen.getByRole("note")).toBeVisible());

      await fillAndSubmitTranslation(user, "ねずみポケモン");

      await waitFor(() =>
        expect(screen.getByRole("note")).toHaveAttribute("data-state", "invalid"),
      );
    },
  );
});

describe("[本体:チュートリアル]ポケモン名当てステップ", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          When: [OPEN_TUTORIAL, PRESS_INTRO_DISMISS, SUBMIT_TRANSLATION],
          Then: "ポケモン名当てステップの吹き出しにタイトル「このポケモンの名前を当てよう」と案内文「「ピカチュウ」または「pikachu」と入力してみてね」が表示される",
        },
      ],
    },
    async () => {
      await proceedToNameStep();

      await waitFor(() => {
        expect(screen.getByText(spec("「ピカチュウ」または「pikachu」と入力してみてね"))).toBeVisible();
      });
      expect(screen.getByText("このポケモンの名前を当てよう")).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          When: [OPEN_TUTORIAL, PRESS_INTRO_DISMISS, SUBMIT_TRANSLATION],
          Then: "ポケモン名当てステップに「ヒントを見る」ボタンが表示されない",
        },
      ],
    },
    async () => {
      await proceedToNameStep();

      expect(screen.queryByRole("button", { name: HINT_BUTTON })).not.toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          When: [
            OPEN_TUTORIAL,
            PRESS_INTRO_DISMISS,
            SUBMIT_TRANSLATION,
            "チュートリアル画面のポケモン名当てステップで、英語名「pikachu」を送信する",
            PRESS_PROCEED,
          ],
          Then: "捕獲待機画面で「ハイパーボールを　使う」ボタンが表示される",
        },
      ],
    },
    async () => {
      const user = await proceedToNameStep();

      await fillAndSubmitName(user, "pikachu");
      await user.click(await screen.findByRole("button", { name: NAME_PROCEED_BUTTON }));

      expect(
        await screen.findByRole("button", { name: ULTRA_BALL_USE_BUTTON }),
      ).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          When: [
            OPEN_TUTORIAL,
            PRESS_INTRO_DISMISS,
            SUBMIT_TRANSLATION,
            "チュートリアル画面のポケモン名当てステップで、日本語名「ピカチュウ」を送信する",
            PRESS_PROCEED,
          ],
          Then: "捕獲待機画面で「スーパーボールを　使う」ボタンが表示される",
        },
      ],
    },
    async () => {
      const user = await proceedToNameStep();

      await fillAndSubmitName(user, "ピカチュウ");
      await user.click(await screen.findByRole("button", { name: NAME_PROCEED_BUTTON }));

      expect(
        await screen.findByRole("button", { name: GREAT_BALL_USE_BUTTON }),
      ).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: NAME_OTHER_THAN_PIKACHU,
          When: [OPEN_TUTORIAL, PRESS_INTRO_DISMISS, SUBMIT_TRANSLATION, SUBMIT_NAME_ANY],
          Then: "捕獲待機画面に進まず、名前の入力欄が表示されたままになる",
        },
      ],
    },
    async () => {
      const user = await proceedToNameStep();

      await fillAndSubmitName(user, "raichu");

      expect(screen.getByPlaceholderText(NAME_PLACEHOLDER)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: NAME_PROCEED_BUTTON })).not.toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: NAME_OTHER_THAN_PIKACHU,
          When: [OPEN_TUTORIAL, PRESS_INTRO_DISMISS, SUBMIT_TRANSLATION, SUBMIT_NAME_ANY],
          Then: SHAKE_GUIDE_BUBBLE,
        },
      ],
    },
    async () => {
      const user = await proceedToNameStep();
      await waitFor(() => expect(screen.getByRole("note")).toBeVisible());

      await fillAndSubmitName(user, "raichu");

      await waitFor(() =>
        expect(screen.getByRole("note")).toHaveAttribute("data-state", "invalid"),
      );
    },
  );
});

describe("[本体:チュートリアル]捕獲ステップと完了", () => {
  for (const { language, input, useButton } of [
    { language: "英語名", input: "pikachu", useButton: ULTRA_BALL_USE_BUTTON },
    { language: "日本語名", input: "ピカチュウ", useButton: GREAT_BALL_USE_BUTTON },
  ]) {
    defineCase(
      {
        種別: "部品間結合テスト",
        正常異常: "正常系",
        steps: [
          {
            When: [
              OPEN_TUTORIAL,
              PRESS_INTRO_DISMISS,
              SUBMIT_TRANSLATION,
              `チュートリアル画面のポケモン名当てステップで、正解の${language}「${input}」を送信する`,
              PRESS_PROCEED,
              `チュートリアル画面の捕獲ステップで、「${useButton}」を押す`,
            ],
            Then: "捕獲成功の演出が表示される",
          },
        ],
      },
      async () => {
        const user = await proceedToNameStep();
        await fillAndSubmitName(user, input);
        await user.click(await screen.findByRole("button", { name: NAME_PROCEED_BUTTON }));
        await user.click(await screen.findByRole("button", { name: useButton }));

        expect(
          await screen.findByTestId("capture-effect-fx", {}, { timeout: 3000 }),
        ).toHaveAttribute("data-state", "success");
      },
    );
  }

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          When: [
            OPEN_TUTORIAL,
            PRESS_INTRO_DISMISS,
            SUBMIT_TRANSLATION,
            "チュートリアル画面のポケモン名当てステップで、正解の英語名「pikachu」を送信する",
            PRESS_PROCEED,
            `チュートリアル画面の捕獲ステップで、「${ULTRA_BALL_USE_BUTTON}」を押す`,
          ],
          Then: "捕獲に成功し、結果画面に完了案内の吹き出し「これでチュートリアルは完了だよ。ポケモンを探しに行こう！」が表示される",
        },
      ],
    },
    async () => {
      await completeTutorial();

      expect(
        await screen.findByText(
          "これでチュートリアルは完了だよ。ポケモンを探しに行こう！",
          {},
          { timeout: 4000 },
        ),
      ).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "チュートリアルが未完了のホーム画面が表示されているとき",
          When: [
            "ホーム画面で「ポケモンを探しに行く」を押して、チュートリアル画面のチュートリアルを最後まで終える",
            "チュートリアル画面の結果画面で、「メニューに戻る」を押す",
            "場所選択画面を開くために、ホーム画面で再び「ポケモンを探しに行く」を押す",
          ],
          Then: "見出し「どこに　ポケモンを　探しに行く？」の場所選択画面が表示される",
        },
      ],
    },
    async () => {
      window.history.pushState({}, "", "/");
      const user = userEvent.setup();
      render(<App />);

      await user.click(await screen.findByRole("button", { name: START_QUEST_BUTTON }));
      await user.click(await screen.findByRole("button", { name: INTRO_DISMISS_BUTTON }));
      await fillAndSubmitTranslation(user, "電気タイプのねずみポケモン");
      await fillAndSubmitName(user, "pikachu");
      await user.click(await screen.findByRole("button", { name: NAME_PROCEED_BUTTON }));
      await user.click(await screen.findByRole("button", { name: ULTRA_BALL_USE_BUTTON }));
      expect(
        await screen.findByText(
          spec("やったー！　ピカチュウを　捕まえたぞ！"),
          {},
          { timeout: 4000 },
        ),
      ).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: BACK_TO_MENU_BUTTON }));
      await user.click(await screen.findByRole("button", { name: START_QUEST_BUTTON }));

      expect(
        await screen.findByRole("heading", { name: "どこに　ポケモンを　探しに行く？" }),
      ).toBeInTheDocument();
    },
  );
});
