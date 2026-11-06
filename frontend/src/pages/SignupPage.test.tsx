import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, beforeEach, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { AuthProvider } from "../contexts/AuthContext";
import { SignupPage } from "./SignupPage";
import { spec } from "../test/labels";
import { defineCase } from "../test/defineCase";

const firebase = vi.hoisted(() => ({
  auth: {},
  accountCreationRequests: [] as { email: string; password: string }[],
  accountCreationErrors: [] as unknown[],
  notifyAuthState: null as ((user: unknown) => void) | null,
}));

vi.mock("../lib/firebase", () => ({ requireAuth: () => firebase.auth }));
vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: class {},
  onAuthStateChanged: (_auth: unknown, notify: (user: unknown) => void) => {
    firebase.notifyAuthState = notify;
    notify(null);
    return () => {};
  },
  createUserWithEmailAndPassword: async (_auth: unknown, email: string, password: string) => {
    const error = firebase.accountCreationErrors.shift();
    if (error) throw error;
    firebase.accountCreationRequests.push({ email, password });
    const user = { emailVerified: false };
    firebase.notifyAuthState?.(user);
    return { user };
  },
  sendEmailVerification: async () => {},
  signOut: async () => {
    firebase.notifyAuthState?.(null);
  },
}));

beforeEach(() => {
  firebase.accountCreationRequests.length = 0;
  firebase.accountCreationErrors.length = 0;
});

function renderPage() {
  return render(
    <AuthProvider>
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>
    </AuthProvider>,
  );
}

/**
 * メールアドレス・パスワード・確認入力を埋めて登録を実行する。
 * @param user userEvent のセッション。
 * @param password 入力するパスワード。
 * @param passwordConfirm 入力する確認用パスワード。
 */
async function submitSignup(
  user: ReturnType<typeof userEvent.setup>,
  password: string,
  passwordConfirm: string,
) {
  await user.type(screen.getByPlaceholderText("メールアドレス"), "dummy@example.com");
  await user.type(screen.getByPlaceholderText("パスワード"), password);
  await user.type(screen.getByPlaceholderText("パスワード（確認）"), passwordConfirm);
  await user.click(screen.getByRole("button", { name: "アカウントを作成する" }));
}

const SUBMIT_SIGNUP =
  "新規登録画面で、メールアドレス・パスワード・「パスワード（確認）」を入力して「アカウントを作成する」を押す";
const RETRY_SIGNUP = "新規登録画面で、もう一度「アカウントを作成する」を押す";
const SUCCESSFUL_SIGNUP =
  "メールアドレスが「dummy@example.com」、パスワードと「パスワード（確認）」がどちらも「dummy-pass-1」で、登録に成功するとき";
const ALREADY_REGISTERED = "すでに登録されているメールアドレスのとき";
const PASSWORD_MISMATCH = "パスワードと「パスワード（確認）」が一致しないとき";
const VERIFICATION_NOTICE_SHOWN = "「確認メールを送りました」の案内画面が表示される";
const ALREADY_REGISTERED_MESSAGE = "「既に登録されています」を含むメッセージが表示される";
const PASSWORD_MISMATCH_MESSAGE = "「パスワードが一致しません」と表示される";

describe("[共通:認証]メールアドレスでの新規登録", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: SUCCESSFUL_SIGNUP,
          When: [SUBMIT_SIGNUP],
          Then: "Firebase Auth に「dummy@example.com」と「dummy-pass-1」でアカウントの作成が依頼される",
        },
      ],
    },
    async () => {
      const user = userEvent.setup();
      renderPage();

      await submitSignup(user, "dummy-pass-1", "dummy-pass-1");

      expect(firebase.accountCreationRequests).toEqual([
        { email: "dummy@example.com", password: "dummy-pass-1" },
      ]);
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [{ Given: SUCCESSFUL_SIGNUP, When: [SUBMIT_SIGNUP], Then: VERIFICATION_NOTICE_SHOWN }],
    },
    async () => {
      const user = userEvent.setup();
      renderPage();

      await submitSignup(user, "dummy-pass-1", "dummy-pass-1");

      expect(await screen.findByText("確認メールを送りました")).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [{ Given: SUCCESSFUL_SIGNUP, When: [SUBMIT_SIGNUP], Then: "エラーメッセージが表示されない" }],
    },
    async () => {
      const user = userEvent.setup();
      renderPage();

      await submitSignup(user, "dummy-pass-1", "dummy-pass-1");

      await screen.findByText("確認メールを送りました");
      expect(screen.queryByTestId("signup-error")).not.toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [{ Given: ALREADY_REGISTERED, When: [SUBMIT_SIGNUP], Then: ALREADY_REGISTERED_MESSAGE }],
    },
    async () => {
      const user = userEvent.setup();
      firebase.accountCreationErrors.push({ code: "auth/email-already-in-use" });
      renderPage();

      await submitSignup(user, "dummy-pass-1", "dummy-pass-1");

      expect(await screen.findByText(/既に登録されています/)).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      観点: ["回復確認"],
      steps: [
        { Given: ALREADY_REGISTERED, When: [SUBMIT_SIGNUP], Then: ALREADY_REGISTERED_MESSAGE },
        {
          When: ["新規登録画面で、メールアドレスを別の「other@example.com」に入力し直す", RETRY_SIGNUP],
          Then: VERIFICATION_NOTICE_SHOWN,
        },
      ],
    },
    async () => {
      const user = userEvent.setup();
      firebase.accountCreationErrors.push({ code: "auth/email-already-in-use" });
      renderPage();
      await submitSignup(user, "dummy-pass-1", "dummy-pass-1");
      await screen.findByText(/既に登録されています/);

      await user.clear(screen.getByPlaceholderText("メールアドレス"));
      await user.type(screen.getByPlaceholderText("メールアドレス"), "other@example.com");
      await user.click(screen.getByRole("button", { name: "アカウントを作成する" }));

      expect(await screen.findByText("確認メールを送りました")).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [{ Given: PASSWORD_MISMATCH, When: [SUBMIT_SIGNUP], Then: PASSWORD_MISMATCH_MESSAGE }],
    },
    async () => {
      const user = userEvent.setup();
      renderPage();

      await submitSignup(user, "dummy-pass-1", "dummy-pass-2");

      expect(await screen.findByTestId("signup-error")).toHaveTextContent(
        spec("パスワードが一致しません"),
      );
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: PASSWORD_MISMATCH,
          When: [SUBMIT_SIGNUP],
          Then: "Firebase Auth にアカウントの作成が依頼されない",
        },
      ],
    },
    async () => {
      const user = userEvent.setup();
      renderPage();

      await submitSignup(user, "dummy-pass-1", "dummy-pass-2");

      await screen.findByTestId("signup-error");
      expect(firebase.accountCreationRequests).toEqual([]);
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      観点: ["回復確認"],
      steps: [
        { Given: PASSWORD_MISMATCH, When: [SUBMIT_SIGNUP], Then: PASSWORD_MISMATCH_MESSAGE },
        {
          When: ["新規登録画面で、「パスワード（確認）」を「パスワード」と同じ「dummy-pass-1」に入力し直す", RETRY_SIGNUP],
          Then: VERIFICATION_NOTICE_SHOWN,
        },
      ],
    },
    async () => {
      const user = userEvent.setup();
      renderPage();
      await submitSignup(user, "dummy-pass-1", "dummy-pass-2");
      await screen.findByTestId("signup-error");

      await user.clear(screen.getByPlaceholderText("パスワード（確認）"));
      await user.type(screen.getByPlaceholderText("パスワード（確認）"), "dummy-pass-1");
      await user.click(screen.getByRole("button", { name: "アカウントを作成する" }));

      expect(await screen.findByText("確認メールを送りました")).toBeInTheDocument();
    },
  );
});
