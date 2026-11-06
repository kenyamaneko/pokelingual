import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, beforeEach, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { AuthProvider } from "../contexts/AuthContext";
import { ResetPasswordPage } from "./ResetPasswordPage";
import { defineCase } from "../test/defineCase";

const firebase = vi.hoisted(() => ({
  auth: {},
  resetEmailRequests: [] as { email: string }[],
  resetEmailErrors: [] as Error[],
}));

vi.mock("../lib/firebase", () => ({ requireAuth: () => firebase.auth }));
vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: class {},
  onAuthStateChanged: (_auth: unknown, notify: (user: unknown) => void) => {
    notify(null);
    return () => {};
  },
  sendPasswordResetEmail: async (_auth: unknown, email: string) => {
    const error = firebase.resetEmailErrors.shift();
    if (error) throw error;
    firebase.resetEmailRequests.push({ email });
  },
}));

beforeEach(() => {
  firebase.resetEmailRequests.length = 0;
  firebase.resetEmailErrors.length = 0;
});

function renderPage() {
  return render(
    <AuthProvider>
      <MemoryRouter>
        <ResetPasswordPage />
      </MemoryRouter>
    </AuthProvider>,
  );
}

const ENTER_EMAIL = "パスワード再設定画面の再設定メールの送信で、メールアドレス欄に「alice@example.com」と入力する";
const PRESS_RESET_EMAIL = "パスワード再設定画面の再設定メールの送信で、「再設定メールを送る」ボタンを押す";
const SUBMIT_RESET_EMAIL = [ENTER_EMAIL, PRESS_RESET_EMAIL] as const;
const SEND_UNAVAILABLE = "再設定メールを送信できないとき";
const SEND_AVAILABLE = "再設定メールを送信できるとき";
const COMPLETION_MESSAGE = "「メールを送信しました」を含む完了メッセージが表示される";
const FAILURE_MESSAGE = "「メールの送信に失敗しました」を含むエラーメッセージが表示される";

describe("[共通:認証]パスワードの再設定", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          When: SUBMIT_RESET_EMAIL,
          Then: "Firebase Auth に「alice@example.com」宛の再設定メールの送信が依頼される",
        },
      ],
    },
    async () => {
      const user = userEvent.setup();
      renderPage();

      await user.type(screen.getByPlaceholderText("メールアドレス"), "alice@example.com");
      await user.click(screen.getByRole("button", { name: "再設定メールを送る" }));

      expect(firebase.resetEmailRequests).toEqual([{ email: "alice@example.com" }]);
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [{ Given: SEND_AVAILABLE, When: SUBMIT_RESET_EMAIL, Then: COMPLETION_MESSAGE }],
    },
    async () => {
      const user = userEvent.setup();
      renderPage();

      await user.type(screen.getByPlaceholderText("メールアドレス"), "alice@example.com");
      await user.click(screen.getByRole("button", { name: "再設定メールを送る" }));

      expect(screen.getByText(/メールを送信しました/)).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        { Given: SEND_AVAILABLE, When: SUBMIT_RESET_EMAIL, Then: "メールアドレスの入力フォームが表示されなくなる" },
      ],
    },
    async () => {
      const user = userEvent.setup();
      renderPage();

      await user.type(screen.getByPlaceholderText("メールアドレス"), "alice@example.com");
      await user.click(screen.getByRole("button", { name: "再設定メールを送る" }));

      expect(screen.queryByPlaceholderText("メールアドレス")).not.toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [{ Given: SEND_UNAVAILABLE, When: SUBMIT_RESET_EMAIL, Then: FAILURE_MESSAGE }],
    },
    async () => {
      const user = userEvent.setup();
      firebase.resetEmailErrors.push(new Error("network"));
      renderPage();

      await user.type(screen.getByPlaceholderText("メールアドレス"), "alice@example.com");
      await user.click(screen.getByRole("button", { name: "再設定メールを送る" }));

      expect(screen.getByText(/メールの送信に失敗しました/)).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [
        { Given: SEND_UNAVAILABLE, When: SUBMIT_RESET_EMAIL, Then: "メールアドレスの入力フォームが表示されたままになる" },
      ],
    },
    async () => {
      const user = userEvent.setup();
      firebase.resetEmailErrors.push(new Error("network"));
      renderPage();

      await user.type(screen.getByPlaceholderText("メールアドレス"), "alice@example.com");
      await user.click(screen.getByRole("button", { name: "再設定メールを送る" }));

      expect(screen.getByPlaceholderText("メールアドレス")).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [
        { Given: SEND_UNAVAILABLE, When: SUBMIT_RESET_EMAIL, Then: FAILURE_MESSAGE },
        {
          Given: SEND_AVAILABLE,
          When: [PRESS_RESET_EMAIL],
          Then: COMPLETION_MESSAGE,
        },
      ],
    },
    async () => {
      const user = userEvent.setup();
      firebase.resetEmailErrors.push(new Error("network"));
      renderPage();
      await user.type(screen.getByPlaceholderText("メールアドレス"), "alice@example.com");
      await user.click(screen.getByRole("button", { name: "再設定メールを送る" }));
      await screen.findByText(/メールの送信に失敗しました/);

      await user.click(screen.getByRole("button", { name: "再設定メールを送る" }));

      expect(await screen.findByText(/メールを送信しました/)).toBeInTheDocument();
    },
  );
});
