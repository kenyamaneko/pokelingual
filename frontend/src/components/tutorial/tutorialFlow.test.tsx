import { screen, waitFor } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import type { User } from "firebase/auth";
import { TutorialPage, TUTORIAL_PAGE_LABELS } from "../../pages/TutorialPage";
import { TUTORIAL_MODAL_LABELS } from "./TutorialInstructionModal";
import { TUTORIAL_TRANSLATION_LABELS } from "./TutorialTranslationStep";
import { TUTORIAL_NAME_LABELS } from "./TutorialNameStep";
import { CAPTURE_RESULT_LABELS } from "../quest/CaptureResult";
import { renderWithProviders } from "../../test/render";
import { countRequests } from "../../test/mswServer";
import { spec } from "../../test/labels";

/**
 * チュートリアルの結合仕様 (一気通貫):
 * ページマウント → 訳文入力 (キーワード判定) → 採点表示 → 名前入力 (完全一致判定)
 * → 捕獲演出 → 結果表示 → 完了フラグ記録まで、TutorialPage を公開入口として確かめる。
 * 判定ロジックは全て frontend 完結なので、HTTP 境界のモックは
 * 完了フラグ記録 (PUT /tutorial-status/complete) の呼び出し回数の検証にのみ使う。
 */

const fakeUser = { uid: "trainer-test" } as unknown as User;

/**
 * 案内モーダルを閉じ、訳文を入力して送信する。
 * @param user userEvent インスタンス。
 * @param translation 送信する訳文。
 */
async function dismissModalAndSubmitTranslation(user: UserEvent, translation: string): Promise<void> {
  await user.click(await screen.findByRole("button", { name: TUTORIAL_MODAL_LABELS.dismissButton }));
  await user.type(screen.getByRole("textbox"), translation);
  await user.click(screen.getByRole("button", { name: TUTORIAL_TRANSLATION_LABELS.submitButton }));
}

/**
 * 案内モーダルを閉じ、名前を入力して送信する。
 * @param user userEvent インスタンス。
 * @param name 送信する名前。
 */
async function dismissModalAndSubmitName(user: UserEvent, name: string): Promise<void> {
  await user.click(await screen.findByRole("button", { name: TUTORIAL_MODAL_LABELS.dismissButton }));
  await user.type(screen.getByPlaceholderText(TUTORIAL_NAME_LABELS.inputPlaceholder), name);
  await user.click(screen.getByRole("button", { name: TUTORIAL_NAME_LABELS.submitButton }));
}

describe("初回チュートリアルの結合 (訳文入力ステップ)", () => {
  it("固定ポケモンの英文と、入力すべき訳文を案内するモーダルが表示される", async () => {
    renderWithProviders(<TutorialPage />, { user: fakeUser, withRouter: true });

    expect(await screen.findByText(spec(TUTORIAL_TRANSLATION_LABELS.modalInstruction))).toBeInTheDocument();
    await screen.findByTestId("quest-description");
  });

  it("必須キーワードを含まない訳文は送信が拒否され、採点画面に進まない", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TutorialPage />, { user: fakeUser, withRouter: true });

    await dismissModalAndSubmitTranslation(user, "ねずみポケモン");

    expect(await screen.findByText(TUTORIAL_TRANSLATION_LABELS.missingKeywordsError)).toBeInTheDocument();
    expect(screen.queryByText("100")).not.toBeInTheDocument();
  });

  it("必須キーワードを含む訳文を送信すると、採点が満点で表示される", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TutorialPage />, { user: fakeUser, withRouter: true });

    await dismissModalAndSubmitTranslation(user, "電気タイプのねずみポケモン");

    expect(await screen.findByText("100")).toBeInTheDocument();
  });
});

/**
 * 訳文ステップを突破し、名前当てステップまで進める。
 * @returns 操作継続に使う userEvent インスタンス。
 */
async function proceedToNameStep(): Promise<UserEvent> {
  const user = userEvent.setup();
  renderWithProviders(<TutorialPage />, { user: fakeUser, withRouter: true });
  await dismissModalAndSubmitTranslation(user, "電気タイプのねずみポケモン");
  await screen.findByText("100");
  return user;
}

describe("初回チュートリアルの結合 (名前当てステップ)", () => {
  it("一致しない名前は送信が拒否され、捕獲画面に進まない", async () => {
    const user = await proceedToNameStep();

    await dismissModalAndSubmitName(user, "raichu");

    expect(await screen.findByText(TUTORIAL_NAME_LABELS.wrongNameError)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: TUTORIAL_PAGE_LABELS.captureButton })).not.toBeInTheDocument();
  });

  it.each(["ピカチュウ", "pikachu", "PIKACHU"])(
    "「%s」と入力すると捕獲ステップに進む",
    async (name) => {
      const user = await proceedToNameStep();

      await dismissModalAndSubmitName(user, name);

      expect(await screen.findByRole("button", { name: TUTORIAL_PAGE_LABELS.captureButton })).toBeInTheDocument();
    },
  );
});

describe("初回チュートリアルの結合 (捕獲〜完了記録)", () => {
  it("ボールを使うと必ず捕獲成功の結果が表示され、完了フラグが1回だけ記録される", async () => {
    const user = await proceedToNameStep();
    await dismissModalAndSubmitName(user, "ピカチュウ");

    await user.click(await screen.findByRole("button", { name: TUTORIAL_PAGE_LABELS.captureButton }));

    expect(await screen.findByText(spec(CAPTURE_RESULT_LABELS.capturedTitle("ピカチュウ")))).toBeInTheDocument();
    await waitFor(() => expect(countRequests("/tutorial-status/complete")).toBe(1));
  });
});
