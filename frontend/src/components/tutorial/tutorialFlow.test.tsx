import { screen, waitFor, render } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import type { User } from "firebase/auth";
import App from "../../App";
import { TutorialPage } from "../../pages/TutorialPage";
import { renderWithProviders } from "../../test/render";
import { spec } from "../../test/labels";

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
 * 遊び方説明を閉じ、翻訳ステップを突破して名前当てステップまで進める。
 * @returns 操作継続に使う userEvent インスタンス。
 */
async function proceedToNameStep(): Promise<UserEvent> {
  const user = await renderTutorialPastIntro();
  await fillAndSubmitTranslation(user, "電気タイプのねずみポケモン");
  await screen.findByPlaceholderText(NAME_PLACEHOLDER);
  return user;
}

/**
 * 名前当てで正解し、ボールを使って結果画面まで到達させる。
 * @returns 操作継続に使う userEvent インスタンス。
 */
async function completeTutorial(): Promise<UserEvent> {
  const user = await proceedToNameStep();
  await fillAndSubmitName(user, "pikachu");
  await user.click(await screen.findByRole("button", { name: NAME_PROCEED_BUTTON }));
  await user.click(await screen.findByRole("button", { name: ULTRA_BALL_USE_BUTTON }));
  return user;
}

describe("[チュートリアル] 遊び方の説明", () => {
  describe("正常系", () => {
    it("チュートリアルを開くと、遊び方の説明モーダルが表示される", async () => {
      renderWithProviders(<TutorialPage />, { user: fakeUser, withRouter: true });

      await screen.findByRole("dialog");
      expect(screen.getByText("遊び方の説明をします")).toBeInTheDocument();
      expect(screen.getByText("吹き出しの指示に従って文字を入力してみてね")).toBeInTheDocument();
    });

    it("遊び方の説明モーダルの「はじめる」を押すと、モーダルが閉じる", async () => {
      const user = userEvent.setup();
      renderWithProviders(<TutorialPage />, { user: fakeUser, withRouter: true });

      await user.click(await screen.findByRole("button", { name: INTRO_DISMISS_BUTTON }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});

describe("[チュートリアル] 翻訳ステップ", () => {
  describe("正常系", () => {
    describe("遊び方の説明モーダルを閉じたとき", () => {
      it("英文「It is an Electric-type Mouse Pokémon.」が表示される", async () => {
        await renderTutorialPastIntro();

        // タイプライター演出で全文表示まで実時間がかかるため、既定の待機時間 (1000ms) を延長する。
        expect(
          await screen.findByText(/It is an Electric-type Mouse Pokémon\./, {}, { timeout: 3000 }),
        ).toBeInTheDocument();
      });

      it("入力すべき翻訳を案内する吹き出しが表示される", async () => {
        await renderTutorialPastIntro();

        await waitFor(() => {
          expect(screen.getByText(spec("「電気タイプのねずみポケモン」と入力してみてね"))).toBeVisible();
        });
        expect(screen.getByText("この英文を訳してみよう")).toBeInTheDocument();
      });
    });

    it("「電気」と「ねずみ」を両方含む翻訳「電気タイプのねずみポケモン」を送信すると、最終評価点が上限の 99% と表示される", async () => {
      const user = await renderTutorialPastIntro();

      await fillAndSubmitTranslation(user, "電気タイプのねずみポケモン");

      expect(await screen.findByText("99%", {}, { timeout: 3000 })).toBeInTheDocument();
    });
  });

  describe("異常系", () => {
    describe("「電気」を含まない翻訳「ねずみポケモン」を送信したとき", () => {
      it("採点結果画面に進まず、翻訳の入力欄が表示されたままになる", async () => {
        const user = await renderTutorialPastIntro();

        await fillAndSubmitTranslation(user, "ねずみポケモン");

        expect(screen.getByRole("textbox")).toBeInTheDocument();
        expect(screen.queryByTestId("damage-value")).not.toBeInTheDocument();
      });

      it("案内の吹き出しが揺れる", async () => {
        const user = await renderTutorialPastIntro();
        await waitFor(() => expect(screen.getByRole("note")).toBeVisible());

        await fillAndSubmitTranslation(user, "ねずみポケモン");

        await waitFor(() => expect(screen.getByRole("note")).toHaveAttribute("data-state", "invalid"));
      });
    });
  });
});

describe("[チュートリアル] 名前当てステップ", () => {
  describe("正常系", () => {
    describe("翻訳ステップを終えて名前当てステップが始まったとき", () => {
      it("入力すべき名前を案内する吹き出しが表示される", async () => {
        await proceedToNameStep();

        await waitFor(() => {
          expect(screen.getByText(spec("「ピカチュウ」または「pikachu」と入力してみてね"))).toBeVisible();
        });
        expect(screen.getByText("このポケモンの名前を当てよう")).toBeInTheDocument();
      });

      it("「ヒントを見る」ボタンが表示されない", async () => {
        await proceedToNameStep();

        expect(screen.queryByRole("button", { name: HINT_BUTTON })).not.toBeInTheDocument();
      });
    });

    describe("名前当てで「次へ進む」を押したとき", () => {
      it.each([
        ["英語名", "pikachu", "ハイパーボール", ULTRA_BALL_USE_BUTTON],
        ["日本語名", "ピカチュウ", "スーパーボール", GREAT_BALL_USE_BUTTON],
      ])(
        "%s「%s」で正解していると、捕獲待機画面で%sを使うボタンが表示される",
        async (_language, input, _ballName, useButton) => {
          const user = await proceedToNameStep();

          await fillAndSubmitName(user, input);
          await user.click(await screen.findByRole("button", { name: NAME_PROCEED_BUTTON }));

          expect(await screen.findByRole("button", { name: useButton })).toBeInTheDocument();
        },
      );
    });
  });

  describe("異常系", () => {
    describe("ピカチュウ以外の名前「raichu」を送信したとき", () => {
      it("捕獲待機画面に進まず、名前の入力欄が表示されたままになる", async () => {
        const user = await proceedToNameStep();

        await fillAndSubmitName(user, "raichu");

        expect(screen.getByPlaceholderText(NAME_PLACEHOLDER)).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: NAME_PROCEED_BUTTON })).not.toBeInTheDocument();
      });

      it("案内の吹き出しが揺れる", async () => {
        const user = await proceedToNameStep();
        await waitFor(() => expect(screen.getByRole("note")).toBeVisible());

        await fillAndSubmitName(user, "raichu");

        await waitFor(() => expect(screen.getByRole("note")).toHaveAttribute("data-state", "invalid"));
      });
    });
  });
});

describe("[チュートリアル] 捕獲ステップと完了", () => {
  describe("正常系", () => {
    it.each([
      ["ハイパーボール", "pikachu", ULTRA_BALL_USE_BUTTON],
      ["スーパーボール", "ピカチュウ", GREAT_BALL_USE_BUTTON],
    ])(
      "獲得したボールが%sのとき、ボールを使うボタンを押すと、捕獲成功の演出が表示される",
      async (_ballName, input, useButton) => {
        const user = await proceedToNameStep();
        await fillAndSubmitName(user, input);
        await user.click(await screen.findByRole("button", { name: NAME_PROCEED_BUTTON }));
        await user.click(await screen.findByRole("button", { name: useButton }));

        expect(
          await screen.findByTestId("capture-effect-fx", {}, { timeout: 3000 }),
        ).toHaveAttribute("data-state", "success");
      },
    );

    it("チュートリアルで捕獲に成功した結果画面に、完了案内の吹き出し「これでチュートリアルは完了だよ。ポケモンを探しに行こう！」が表示される", async () => {
      await completeTutorial();

      expect(
        await screen.findByText(
          "これでチュートリアルは完了だよ。ポケモンを探しに行こう！",
          {},
          { timeout: 4000 },
        ),
      ).toBeInTheDocument();
    });

    it("チュートリアルを完了して「メニューに戻る」を押し、ホーム画面で「ポケモンを探しに行く」を押すと、本番のクエスト画面が表示される", async () => {
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
    });
  });
});
