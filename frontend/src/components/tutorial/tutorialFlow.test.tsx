import { screen, waitFor, render } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import type { User } from "firebase/auth";
import App from "../../App";
import { TutorialPage, TUTORIAL_PAGE_LABELS } from "../../pages/TutorialPage";
import { TUTORIAL_INTRO_LABELS } from "./TutorialIntroModal";
import { TUTORIAL_COMPLETION_LABELS } from "./TutorialCompletionCallout";
import { TRANSLATION_INPUT_LABELS } from "../quest/TranslationInput";
import { POKEMON_NAME_INPUT_LABELS } from "../quest/PokemonNameInput";
import { NAME_GUESS_LABELS } from "../quest/NameGuess";
import { CAPTURE_RESULT_LABELS } from "../quest/CaptureResult";
import { captureUseButtonLabel } from "../quest/ballAssets";
import { renderWithProviders } from "../../test/render";
import { spec } from "../../test/labels";
import { requestLog, apiUrl } from "../../test/mswServer";

const fakeUser = { uid: "trainer-test" } as unknown as User;

/**
 * チュートリアルを描画し、開始時の遊び方説明モーダルを閉じて操作可能な状態にする。
 * @returns 操作継続に使う userEvent インスタンス。
 */
async function renderTutorialPastIntro(): Promise<UserEvent> {
  const user = userEvent.setup();
  renderWithProviders(<TutorialPage />, { user: fakeUser, withRouter: true });
  await user.click(await screen.findByRole("button", { name: TUTORIAL_INTRO_LABELS.dismissButton }));
  return user;
}

/**
 * 訳文を入力して送信する。
 * @param user userEvent インスタンス。
 * @param translation 送信する訳文。
 */
async function fillAndSubmitTranslation(user: UserEvent, translation: string): Promise<void> {
  await user.type(await screen.findByRole("textbox"), translation);
  await user.click(screen.getByRole("button", { name: TRANSLATION_INPUT_LABELS.submitButton }));
}

/**
 * 名前を入力して送信する。
 * @param user userEvent インスタンス。
 * @param name 送信する名前。
 */
async function fillAndSubmitName(user: UserEvent, name: string): Promise<void> {
  await user.type(await screen.findByPlaceholderText(POKEMON_NAME_INPUT_LABELS.inputPlaceholder), name);
  await user.click(screen.getByRole("button", { name: POKEMON_NAME_INPUT_LABELS.submitButton }));
}

/**
 * 遊び方説明を閉じ、訳文ステップを突破して名前当てステップまで進める。
 * @returns 操作継続に使う userEvent インスタンス。
 */
async function proceedToNameStep(): Promise<UserEvent> {
  const user = await renderTutorialPastIntro();
  await fillAndSubmitTranslation(user, "電気タイプのねずみポケモン");
  await screen.findByPlaceholderText(POKEMON_NAME_INPUT_LABELS.inputPlaceholder);
  return user;
}

/**
 * 名前当てで正解し、ボールを使って結果画面まで到達させる。
 * @returns 操作継続に使う userEvent インスタンス。
 */
async function completeTutorial(): Promise<UserEvent> {
  const user = await proceedToNameStep();
  await fillAndSubmitName(user, "pikachu");
  await user.click(await screen.findByRole("button", { name: NAME_GUESS_LABELS.proceedButton }));
  await user.click(await screen.findByRole("button", { name: captureUseButtonLabel("ultra") }));
  return user;
}

describe("チュートリアル (遊び方説明モーダル)", () => {
  it("チュートリアルを開くと、遊び方を説明するモーダルが表示される", async () => {
    renderWithProviders(<TutorialPage />, { user: fakeUser, withRouter: true });

    await screen.findByRole("dialog");
    expect(screen.getByText(TUTORIAL_INTRO_LABELS.title)).toBeInTheDocument();
    expect(screen.getByText(TUTORIAL_INTRO_LABELS.body)).toBeInTheDocument();
  });

  it("「はじめる」を押すと、遊び方説明モーダルが閉じる", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TutorialPage />, { user: fakeUser, withRouter: true });

    await user.click(await screen.findByRole("button", { name: TUTORIAL_INTRO_LABELS.dismissButton }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("チュートリアル (訳文入力ステップ)", () => {
  it("固定ポケモンの英文と、入力すべき訳文を案内する吹き出しが表示される", async () => {
    await renderTutorialPastIntro();

    await screen.findByTestId("quest-description");
    await waitFor(() => {
      expect(screen.getByText(spec(TUTORIAL_PAGE_LABELS.translation.instruction))).toBeVisible();
    });
    expect(screen.getByText(TUTORIAL_PAGE_LABELS.translation.title)).toBeInTheDocument();
  });

  it("案内どおりでない訳文では、採点画面に進めない", async () => {
    const user = await renderTutorialPastIntro();

    await fillAndSubmitTranslation(user, "ねずみポケモン");

    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.queryByTestId("damage-value")).not.toBeInTheDocument();
  });

  it("案内どおりの訳文を入力すると、採点画面に進み満点が表示される", async () => {
    const user = await renderTutorialPastIntro();

    await fillAndSubmitTranslation(user, "電気タイプのねずみポケモン");

    // ダメージ数値は博士のコメント・説明文のタイプライターと HP 減少アニメーションの完了後に表示される。
    expect(await screen.findByTestId("damage-value", {}, { timeout: 3000 })).toHaveTextContent("100%");
  });
});

describe("チュートリアル (名前当てステップ)", () => {
  it("入力すべき名前を案内する吹き出しが表示される", async () => {
    await proceedToNameStep();

    await waitFor(() => {
      expect(screen.getByText(spec(TUTORIAL_PAGE_LABELS.name.instruction))).toBeVisible();
    });
    expect(screen.getByText(TUTORIAL_PAGE_LABELS.name.title)).toBeInTheDocument();
  });

  it("案内どおりでない名前では、捕獲画面に進めない", async () => {
    const user = await proceedToNameStep();

    await fillAndSubmitName(user, "raichu");

    expect(screen.getByPlaceholderText(POKEMON_NAME_INPUT_LABELS.inputPlaceholder)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: NAME_GUESS_LABELS.proceedButton })).not.toBeInTheDocument();
  });

  it("案内どおりの名前を入力すると、獲得したボールを持って捕獲画面に進む", async () => {
    const user = await proceedToNameStep();

    await fillAndSubmitName(user, "pikachu");
    await user.click(await screen.findByRole("button", { name: NAME_GUESS_LABELS.proceedButton }));

    expect(
      await screen.findByRole("button", { name: captureUseButtonLabel("ultra") }),
    ).toBeInTheDocument();
  });
});

describe("チュートリアル (捕獲演出〜完了)", () => {
  it("ボールを使うと、捕獲成功の演出が再生される", async () => {
    const user = await proceedToNameStep();
    await fillAndSubmitName(user, "pikachu");
    await user.click(await screen.findByRole("button", { name: NAME_GUESS_LABELS.proceedButton }));
    await user.click(await screen.findByRole("button", { name: captureUseButtonLabel("ultra") }));

    expect(
      await screen.findByTestId("capture-effect-fx", {}, { timeout: 3000 }),
    ).toHaveAttribute("data-state", "success");
  });

  it("捕獲成功の結果画面に、チュートリアル完了を伝える吹き出しが表示される", async () => {
    await completeTutorial();

    expect(
      await screen.findByText(TUTORIAL_COMPLETION_LABELS.message, {}, { timeout: 3000 }),
    ).toBeInTheDocument();
  });

  it("チュートリアルの捕獲は、本番のクエスト経路を呼ばない", async () => {
    await completeTutorial();
    await screen.findByText(TUTORIAL_COMPLETION_LABELS.message, {}, { timeout: 3000 });

    const prodCapturePath = new URL(apiUrl("/quest/capture")).pathname;
    expect(requestLog.filter((r) => r.path === prodCapturePath)).toHaveLength(0);
  });

  it("捕獲後にメニューへ戻ると、ホームの「ポケモンを探しに行く」が本番クエストへの導線に切り替わる", async () => {
    window.history.pushState({}, "", "/");
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("link", { name: "ポケモンを探しに行く" }));
    await user.click(await screen.findByRole("button", { name: TUTORIAL_INTRO_LABELS.dismissButton }));
    await fillAndSubmitTranslation(user, "電気タイプのねずみポケモン");
    await fillAndSubmitName(user, "pikachu");
    await user.click(await screen.findByRole("button", { name: NAME_GUESS_LABELS.proceedButton }));
    await user.click(await screen.findByRole("button", { name: captureUseButtonLabel("ultra") }));
    expect(
      await screen.findByText(spec(CAPTURE_RESULT_LABELS.capturedTitle("ピカチュウ")), {}, { timeout: 3000 }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: CAPTURE_RESULT_LABELS.backToMenuButton }));

    expect(await screen.findByRole("link", { name: "ポケモンを探しに行く" })).toHaveAttribute("href", "/quest");
  });
});
