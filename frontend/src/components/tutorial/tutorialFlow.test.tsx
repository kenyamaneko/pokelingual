import { screen, waitFor, render } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import type { User } from "firebase/auth";
import App from "../../App";
import { TutorialPage } from "../../pages/TutorialPage";
import { TUTORIAL_TRANSLATION_LABELS } from "./TutorialTranslationStep";
import { TUTORIAL_NAME_LABELS } from "./TutorialNameStep";
import { TUTORIAL_INTRO_LABELS } from "./TutorialIntroModal";
import { TUTORIAL_COMPLETION_LABELS } from "./TutorialCompletionCallout";
import { TRANSLATION_INPUT_LABELS } from "../quest/TranslationInput";
import { POKEMON_NAME_INPUT_LABELS } from "../quest/PokemonNameInput";
import { CAPTURE_RESULT_LABELS } from "../quest/CaptureResult";
import { captureUseButtonLabel } from "../quest/ballAssets";
import { renderWithProviders } from "../../test/render";
import { spec } from "../../test/labels";
import { countRequests } from "../../test/mswServer";

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

describe("チュートリアルへの遷移", () => {
  it("チュートリアル未完了なら、ログイン後チュートリアル画面に遷移する", async () => {
    window.history.pushState({}, "", "/");
    const user = userEvent.setup();
    render(<App />);

    const link = await screen.findByRole("link", { name: "ポケモンを探しに行く" });
    await waitFor(() => expect(link).toHaveAttribute("href", "/tutorial"));
    await user.click(link);

    expect(await screen.findByTestId("quest-description")).toBeInTheDocument();
  });
});

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

    await waitFor(() => {
      expect(screen.getByText(spec(TUTORIAL_TRANSLATION_LABELS.instruction))).toBeVisible();
    });
    await screen.findByTestId("quest-description");
  });

  it("訳文を入力している間も、案内の吹き出しは表示されたままになる", async () => {
    const user = await renderTutorialPastIntro();

    await waitFor(() => {
      expect(screen.getByText(spec(TUTORIAL_TRANSLATION_LABELS.instruction))).toBeVisible();
    });
    await user.type(screen.getByRole("textbox"), "電気タイプのねずみポケモン");

    expect(screen.getByText(spec(TUTORIAL_TRANSLATION_LABELS.instruction))).toBeVisible();
  });

  it("「ねずみポケモン」と入力しても、採点画面に進めない", async () => {
    const user = await renderTutorialPastIntro();

    await fillAndSubmitTranslation(user, "ねずみポケモン");

    expect(await screen.findByText(TUTORIAL_TRANSLATION_LABELS.missingKeywordsError)).toBeInTheDocument();
    expect(screen.queryByText("100%")).not.toBeInTheDocument();
  });

  it("「電気タイプのねずみポケモン」と入力すると、採点画面に進み満点が表示される", async () => {
    const user = await renderTutorialPastIntro();

    await fillAndSubmitTranslation(user, "電気タイプのねずみポケモン");

    // ダメージ数値は博士のコメント・説明文のタイプライターと HP 減少アニメーションの完了後に
    // 表示されるため、既定の待機時間を延長する。
    expect(
      await screen.findByTestId("damage-value", {}, { timeout: 3000 }),
    ).toHaveTextContent("100%");
  });

  it("「電気タイプのねずみポケモン」と入力すると、採点画面に君の翻訳として入力した訳文が表示される", async () => {
    const user = await renderTutorialPastIntro();

    await fillAndSubmitTranslation(user, "電気タイプのねずみポケモン");

    expect(await screen.findByText("電気タイプのねずみポケモン")).toBeInTheDocument();
  });

  it("「電気タイプのねずみポケモン」と入力すると、採点画面に日本語の説明文「電気タイプのねずみポケモン」が表示される", async () => {
    const user = await renderTutorialPastIntro();

    await fillAndSubmitTranslation(user, "電気タイプのねずみポケモン");

    expect(await screen.findByText("「電気タイプのねずみポケモン」")).toBeInTheDocument();
  });

  it("「電気タイプのねずみポケモン」と入力すると、採点画面に博士からのコメント「かんぺきな　ほんやくだ！」が表示される", async () => {
    const user = await renderTutorialPastIntro();

    await fillAndSubmitTranslation(user, "電気タイプのねずみポケモン");

    expect(await screen.findByText(spec("かんぺきな　ほんやくだ！"))).toBeInTheDocument();
  });

  it("必須キーワード不足のエラーが出た後、訳文を入力し直すとエラー表示が消える", async () => {
    const user = await renderTutorialPastIntro();

    await fillAndSubmitTranslation(user, "ねずみポケモン");
    expect(await screen.findByText(TUTORIAL_TRANSLATION_LABELS.missingKeywordsError)).toBeInTheDocument();

    await user.type(screen.getByRole("textbox"), "電気タイプの");

    expect(screen.queryByText(TUTORIAL_TRANSLATION_LABELS.missingKeywordsError)).not.toBeInTheDocument();
  });
});

/**
 * 遊び方説明を閉じ、訳文ステップを突破して名前当てステップまで進める。
 * @returns 操作継続に使う userEvent インスタンス。
 */
async function proceedToNameStep(): Promise<UserEvent> {
  const user = await renderTutorialPastIntro();
  await fillAndSubmitTranslation(user, "電気タイプのねずみポケモン");
  await screen.findByText("100%");
  return user;
}

/**
 * 名前当てまで進め、日本語名で正解してボールを使い、結果画面に到達させる。
 * @returns 操作継続に使う userEvent インスタンス。
 */
async function completeTutorial(): Promise<UserEvent> {
  const user = await proceedToNameStep();
  await fillAndSubmitName(user, "ピカチュウ");
  await user.click(await screen.findByRole("button", { name: captureUseButtonLabel("great") }));
  return user;
}

describe("チュートリアル (名前当てステップ)", () => {
  it("名前を入力している間も、案内の吹き出しは表示されたままになる", async () => {
    const user = await proceedToNameStep();

    await waitFor(() => {
      expect(screen.getByText(spec(TUTORIAL_NAME_LABELS.instruction))).toBeVisible();
    });
    await user.type(screen.getByPlaceholderText(POKEMON_NAME_INPUT_LABELS.inputPlaceholder), "pika");

    expect(screen.getByText(spec(TUTORIAL_NAME_LABELS.instruction))).toBeVisible();
  });

  it("「raichu」と入力しても、捕獲画面に進めない", async () => {
    const user = await proceedToNameStep();

    await fillAndSubmitName(user, "raichu");

    expect(await screen.findByText(TUTORIAL_NAME_LABELS.wrongNameError)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(POKEMON_NAME_INPUT_LABELS.inputPlaceholder)).toBeInTheDocument();
  });

  it.each([
    { input: "pikachu", ballName: "ハイパーボール", ballType: "ultra" as const },
    { input: "ピカチュウ", ballName: "スーパーボール", ballType: "great" as const },
  ])("$input と入力すると、$ballName を持って捕獲画面に進む", async ({ input, ballType }) => {
    const user = await proceedToNameStep();

    await fillAndSubmitName(user, input);

    expect(
      await screen.findByRole("button", { name: captureUseButtonLabel(ballType) }),
    ).toBeInTheDocument();
  });

  it("間違った名前のエラーが出た後、名前を入力し直すとエラー表示が消える", async () => {
    const user = await proceedToNameStep();

    await fillAndSubmitName(user, "raichu");
    expect(await screen.findByText(TUTORIAL_NAME_LABELS.wrongNameError)).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(POKEMON_NAME_INPUT_LABELS.inputPlaceholder), "pika");

    expect(screen.queryByText(TUTORIAL_NAME_LABELS.wrongNameError)).not.toBeInTheDocument();
  });
});

describe("チュートリアル (捕獲演出〜完了)", () => {
  it("名前を当ててボールを使うと、捕獲成功の演出が再生される", async () => {
    const user = await proceedToNameStep();

    await fillAndSubmitName(user, "ピカチュウ");
    await user.click(await screen.findByRole("button", { name: captureUseButtonLabel("great") }));

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

  it("チュートリアルを最後まで進めても、クエストのバックエンドを呼ばず図鑑・実績に記録されない", async () => {
    await completeTutorial();
    await screen.findByText(TUTORIAL_COMPLETION_LABELS.message, {}, { timeout: 3000 });

    const questBackendCalls =
      countRequests("/quest/score") +
      countRequests("/quest/guess-name") +
      countRequests("/quest/capture");
    expect(questBackendCalls).toBe(0);
  });

  it("捕獲後にメニューへ戻ると、ホームの「ポケモンを探しに行く」が本番クエストへの導線に切り替わる", async () => {
    window.history.pushState({}, "", "/");
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("link", { name: "ポケモンを探しに行く" }));
    await user.click(await screen.findByRole("button", { name: TUTORIAL_INTRO_LABELS.dismissButton }));
    await fillAndSubmitTranslation(user, "電気タイプのねずみポケモン");
    await screen.findByText("100%");
    await fillAndSubmitName(user, "ピカチュウ");
    await user.click(await screen.findByRole("button", { name: captureUseButtonLabel("great") }));
    expect(
      await screen.findByText(spec(CAPTURE_RESULT_LABELS.capturedTitle("ピカチュウ")), {}, { timeout: 3000 }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: CAPTURE_RESULT_LABELS.backToMenuButton }));

    expect(await screen.findByRole("link", { name: "ポケモンを探しに行く" })).toHaveAttribute("href", "/quest");
  });
});
