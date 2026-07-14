import { screen, waitFor, render } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import type { User } from "firebase/auth";
import App from "../../App";
import { TutorialPage } from "../../pages/TutorialPage";
import { TUTORIAL_TRANSLATION_LABELS } from "./TutorialTranslationStep";
import { TUTORIAL_NAME_LABELS } from "./TutorialNameStep";
import { TRANSLATION_INPUT_LABELS } from "../quest/TranslationInput";
import { POKEMON_NAME_INPUT_LABELS } from "../quest/PokemonNameInput";
import { CAPTURE_RESULT_LABELS } from "../quest/CaptureResult";
import { captureUseButtonLabel } from "../quest/ballAssets";
import { renderWithProviders } from "../../test/render";
import { spec } from "../../test/labels";

const fakeUser = { uid: "trainer-test" } as unknown as User;

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

describe("チュートリアル (訳文入力ステップ)", () => {
  it("固定ポケモンの英文と、入力すべき訳文を案内する吹き出しが表示される", async () => {
    renderWithProviders(<TutorialPage />, { user: fakeUser, withRouter: true });

    await waitFor(() => {
      expect(screen.getByText(spec(TUTORIAL_TRANSLATION_LABELS.instruction))).toBeVisible();
    });
    await screen.findByTestId("quest-description");
  });

  it("訳文を入力している間も、案内の吹き出しは表示されたままになる", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TutorialPage />, { user: fakeUser, withRouter: true });

    await waitFor(() => {
      expect(screen.getByText(spec(TUTORIAL_TRANSLATION_LABELS.instruction))).toBeVisible();
    });
    await user.type(screen.getByRole("textbox"), "電気タイプのねずみポケモン");

    expect(screen.getByText(spec(TUTORIAL_TRANSLATION_LABELS.instruction))).toBeVisible();
  });

  it("「ねずみポケモン」と入力しても、採点画面に進めない", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TutorialPage />, { user: fakeUser, withRouter: true });

    await fillAndSubmitTranslation(user, "ねずみポケモン");

    expect(await screen.findByText(TUTORIAL_TRANSLATION_LABELS.missingKeywordsError)).toBeInTheDocument();
    expect(screen.queryByText("100")).not.toBeInTheDocument();
  });

  it("「電気タイプのねずみポケモン」と入力すると、採点画面に進み満点が表示される", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TutorialPage />, { user: fakeUser, withRouter: true });

    await fillAndSubmitTranslation(user, "電気タイプのねずみポケモン");

    expect(await screen.findByText("100")).toBeInTheDocument();
  });

  it("「電気タイプのねずみポケモン」と入力すると、採点画面に君の翻訳として入力した訳文が表示される", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TutorialPage />, { user: fakeUser, withRouter: true });

    await fillAndSubmitTranslation(user, "電気タイプのねずみポケモン");

    expect(await screen.findByText("電気タイプのねずみポケモン")).toBeInTheDocument();
  });

  it("「電気タイプのねずみポケモン」と入力すると、採点画面に日本語の説明文「電気タイプのねずみポケモン」が表示される", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TutorialPage />, { user: fakeUser, withRouter: true });

    await fillAndSubmitTranslation(user, "電気タイプのねずみポケモン");

    expect(await screen.findByText("「電気タイプのねずみポケモン」")).toBeInTheDocument();
  });

  it("「電気タイプのねずみポケモン」と入力すると、採点画面に博士からのコメント「かんぺきな　ほんやくだ！」が表示される", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TutorialPage />, { user: fakeUser, withRouter: true });

    await fillAndSubmitTranslation(user, "電気タイプのねずみポケモン");

    // タイプライター演出がダメージメーターのアニメーション完了後 (1000ms) に始まるため、既定の待機時間を延長する。
    expect(
      await screen.findByText(spec("かんぺきな　ほんやくだ！"), {}, { timeout: 3000 }),
    ).toBeInTheDocument();
  });

  it("必須キーワード不足のエラーが出た後、訳文を入力し直すとエラー表示が消える", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TutorialPage />, { user: fakeUser, withRouter: true });

    await fillAndSubmitTranslation(user, "ねずみポケモン");
    expect(await screen.findByText(TUTORIAL_TRANSLATION_LABELS.missingKeywordsError)).toBeInTheDocument();

    await user.type(screen.getByRole("textbox"), "電気タイプの");

    expect(screen.queryByText(TUTORIAL_TRANSLATION_LABELS.missingKeywordsError)).not.toBeInTheDocument();
  });
});

/**
 * 訳文ステップを突破し、名前当てステップまで進める。
 * @returns 操作継続に使う userEvent インスタンス。
 */
async function proceedToNameStep(): Promise<UserEvent> {
  const user = userEvent.setup();
  renderWithProviders(<TutorialPage />, { user: fakeUser, withRouter: true });
  await fillAndSubmitTranslation(user, "電気タイプのねずみポケモン");
  await screen.findByText("100");
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
    expect(screen.queryByRole("button", { name: captureUseButtonLabel("poke") })).not.toBeInTheDocument();
  });

  it("「ピカチュウ」と入力すると捕獲画面に進む", async () => {
    const user = await proceedToNameStep();

    await fillAndSubmitName(user, "ピカチュウ");

    expect(await screen.findByRole("button", { name: captureUseButtonLabel("poke") })).toBeInTheDocument();
  });

  it("間違った名前のエラーが出た後、名前を入力し直すとエラー表示が消える", async () => {
    const user = await proceedToNameStep();

    await fillAndSubmitName(user, "raichu");
    expect(await screen.findByText(TUTORIAL_NAME_LABELS.wrongNameError)).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(POKEMON_NAME_INPUT_LABELS.inputPlaceholder), "pika");

    expect(screen.queryByText(TUTORIAL_NAME_LABELS.wrongNameError)).not.toBeInTheDocument();
  });
});

describe("チュートリアル (捕獲〜完了記録)", () => {
  it("捕獲後にメニューへ戻ると、ホームの「ポケモンを探しに行く」が本番クエストへの導線に切り替わる", async () => {
    window.history.pushState({}, "", "/");
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("link", { name: "ポケモンを探しに行く" }));
    await fillAndSubmitTranslation(user, "電気タイプのねずみポケモン");
    await screen.findByText("100");
    await fillAndSubmitName(user, "ピカチュウ");
    await user.click(await screen.findByRole("button", { name: captureUseButtonLabel("poke") }));
    expect(await screen.findByText(spec(CAPTURE_RESULT_LABELS.capturedTitle("ピカチュウ")))).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: CAPTURE_RESULT_LABELS.backToMenuButton }));

    expect(await screen.findByRole("link", { name: "ポケモンを探しに行く" })).toHaveAttribute("href", "/quest");
  });
});
