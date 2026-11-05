import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, vi } from "vitest";
import { useState } from "react";
import { MemoryRouter, Routes, Route } from "react-router";
import type { User } from "firebase/auth";
import { AuthContext } from "../contexts/AuthContext";
import { TutorialProvider } from "../contexts/TutorialContext";
import { HomePage } from "./HomePage";
import { LoginPage } from "./LoginPage";
import { spec } from "../test/labels";
import { defineCase } from "../test/defineCase";
import { EmailNotVerifiedError } from "../utils/authErrors";

const START_QUEST_BUTTON = "ポケモンを探しに行く";

/**
 * Firebase 認証は外部との境界のため、AuthContext ごとモックする。ログイン後の遷移先のホーム画面は実物を使う。
 * @param login 認証境界となる login 実装 (成功/失敗を差し込む)。
 * @returns レンダリング結果。
 */
function renderLogin(login: (email: string, password: string) => Promise<void>) {
  function Harness() {
    const [user, setUser] = useState<User | null>(null);
    const auth = {
      user,
      loading: false,
      login: async (email: string, password: string) => {
        await login(email, password);
        // 認証の成功で AuthContext の user が確定する本番の動きに合わせるため、login 成功後に user を設定する
        setUser({ uid: "dummy-uid" } as unknown as User);
      },
      signup: async () => {},
      loginWithGoogle: async () => {},
      resetPassword: async () => {},
      logout: async () => {},
    };
    return (
      <AuthContext.Provider value={auth}>
        <TutorialProvider>
          <MemoryRouter initialEntries={["/login"]}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
            </Routes>
          </MemoryRouter>
        </TutorialProvider>
      </AuthContext.Provider>
    );
  }
  return render(<Harness />);
}

/**
 * メールアドレスとパスワードを入力してメールログインを実行する。
 * @param user userEvent のセッション。
 * @param email 入力するメールアドレス。
 * @param password 入力するパスワード。
 */
async function submitLogin(
  user: ReturnType<typeof userEvent.setup>,
  email: string,
  password: string,
) {
  await user.type(screen.getByPlaceholderText("メールアドレス"), email);
  await user.type(screen.getByPlaceholderText("パスワード"), password);
  await user.click(screen.getByRole("button", { name: "メールでログイン" }));
}

const CORRECT_PASSWORD = "dummy-password";

const SUBMIT_LOGIN = "ログイン画面で、メールアドレスとパスワードを入力して「メールでログイン」を押す";
const RETRY_LOGIN = "ログイン画面で、もう一度「メールでログイン」を押す";
const UNVERIFIED_ACCOUNT = "メールアドレスが未確認のアカウントのとき";
const WRONG_CREDENTIALS = "メールアドレスまたはパスワードが間違っているとき";
const HOME_SHOWN = "ホーム画面が表示される";
const UNVERIFIED_MESSAGE = "「メールが未確認です」を含む確認を促すメッセージが表示される";
const WRONG_CREDENTIALS_MESSAGE = "「メールアドレスまたはパスワードが間違っています」と表示される";

describe("[本体:認証]メールアドレスでのログイン", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [{ Given: "正しいメールアドレスとパスワードのとき", When: [SUBMIT_LOGIN], Then: HOME_SHOWN }],
    },
    async () => {
      const user = userEvent.setup();
      renderLogin(vi.fn().mockResolvedValue(undefined));

      await submitLogin(user, "dummy@example.com", CORRECT_PASSWORD);

      expect(await screen.findByRole("button", { name: START_QUEST_BUTTON })).toBeInTheDocument();
    },
  );

  for (const { given, loginError, password, errorMessage } of [
    {
      given: UNVERIFIED_ACCOUNT,
      loginError: new EmailNotVerifiedError(),
      password: CORRECT_PASSWORD,
      errorMessage: /メールが未確認です/,
    },
    {
      given: WRONG_CREDENTIALS,
      loginError: new Error("auth error"),
      password: "wrong-password",
      errorMessage: spec("メールアドレスまたはパスワードが間違っています"),
    },
  ]) {
    defineCase(
      {
        種別: "部品間結合テスト",
        正常異常: "異常系",
        steps: [{ Given: given, When: [SUBMIT_LOGIN], Then: "ホーム画面が表示されない" }],
      },
      async () => {
        const user = userEvent.setup();
        renderLogin(vi.fn().mockRejectedValue(loginError));

        await submitLogin(user, "dummy@example.com", password);

        await screen.findByText(errorMessage);
        expect(screen.queryByRole("button", { name: START_QUEST_BUTTON })).not.toBeInTheDocument();
      },
    );
  }

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [{ Given: UNVERIFIED_ACCOUNT, When: [SUBMIT_LOGIN], Then: UNVERIFIED_MESSAGE }],
    },
    async () => {
      const user = userEvent.setup();
      renderLogin(vi.fn().mockRejectedValue(new EmailNotVerifiedError()));

      await submitLogin(user, "dummy@example.com", CORRECT_PASSWORD);

      expect(await screen.findByText(/メールが未確認です/)).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [
        { Given: UNVERIFIED_ACCOUNT, When: [SUBMIT_LOGIN], Then: UNVERIFIED_MESSAGE },
        { Given: "メールアドレスの確認が済んでいるとき", When: [RETRY_LOGIN], Then: HOME_SHOWN },
      ],
    },
    async () => {
      const user = userEvent.setup();
      renderLogin(
        vi
          .fn()
          .mockRejectedValueOnce(new EmailNotVerifiedError())
          .mockResolvedValue(undefined),
      );
      await submitLogin(user, "dummy@example.com", CORRECT_PASSWORD);
      await screen.findByText(/メールが未確認です/);

      await user.click(screen.getByRole("button", { name: "メールでログイン" }));

      expect(await screen.findByRole("button", { name: START_QUEST_BUTTON })).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [{ Given: WRONG_CREDENTIALS, When: [SUBMIT_LOGIN], Then: WRONG_CREDENTIALS_MESSAGE }],
    },
    async () => {
      const user = userEvent.setup();
      renderLogin(vi.fn().mockRejectedValue(new Error("auth error")));

      await submitLogin(user, "dummy@example.com", "wrong-password");

      expect(
        await screen.findByText(spec("メールアドレスまたはパスワードが間違っています")),
      ).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [{ Given: WRONG_CREDENTIALS, When: [SUBMIT_LOGIN], Then: "「メールでログイン」ボタンがもう一度押せる状態のままになる" }],
    },
    async () => {
      const user = userEvent.setup();
      renderLogin(vi.fn().mockRejectedValue(new Error("auth error")));

      await submitLogin(user, "dummy@example.com", "wrong-password");

      await screen.findByText(spec("メールアドレスまたはパスワードが間違っています"));
      expect(screen.getByRole("button", { name: "メールでログイン" })).toBeEnabled();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [
        { Given: WRONG_CREDENTIALS, When: [SUBMIT_LOGIN], Then: WRONG_CREDENTIALS_MESSAGE },
        { When: ["ログイン画面のパスワード欄に、正しいパスワードを入力し直す", RETRY_LOGIN], Then: HOME_SHOWN },
      ],
    },
    async () => {
      const user = userEvent.setup();
      renderLogin(
        vi.fn().mockRejectedValueOnce(new Error("auth error")).mockResolvedValue(undefined),
      );
      await submitLogin(user, "dummy@example.com", "wrong-password");
      await screen.findByText(spec("メールアドレスまたはパスワードが間違っています"));

      await user.clear(screen.getByPlaceholderText("パスワード"));
      await user.type(screen.getByPlaceholderText("パスワード"), CORRECT_PASSWORD);
      await user.click(screen.getByRole("button", { name: "メールでログイン" }));

      expect(await screen.findByRole("button", { name: START_QUEST_BUTTON })).toBeInTheDocument();
    },
  );
});

describe("[本体:サイト情報]ログイン画面の問い合わせ", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          When: ["問い合わせのリンクを表示するために、ログイン画面を開く"],
          Then: "「問い合わせ」のリンク先は「https://forms.gle/mUhMjSMf8TPJc3CC9」で、新しいタブで開く",
        },
      ],
    },
    () => {
      renderLogin(vi.fn());

      const contact = screen.getByRole("link", { name: "問い合わせ" });
      expect(contact).toHaveAttribute("href", "https://forms.gle/mUhMjSMf8TPJc3CC9");
      expect(contact).toHaveAttribute("target", "_blank");
    },
  );
});

async function renderLoginWithTermsModalOpen() {
  const user = userEvent.setup();
  renderLogin(vi.fn());
  await user.click(screen.getByRole("button", { name: "利用規約" }));
  return user;
}

describe("[本体:サイト情報]ログイン画面の利用規約", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [{ When: ["ログイン画面で、利用規約を表示するために「利用規約」を押す"], Then: "利用規約モーダルが表示される" }],
    },
    async () => {
      const user = userEvent.setup();
      renderLogin(vi.fn());

      await user.click(screen.getByRole("button", { name: "利用規約" }));

      expect(screen.getByRole("dialog")).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "利用規約モーダルが開いているとき",
          When: ["ログイン画面の利用規約モーダルで、「閉じる」を押す"],
          Then: "モーダルが閉じてログイン画面が表示される",
        },
      ],
    },
    async () => {
      const user = await renderLoginWithTermsModalOpen();

      await user.click(screen.getByRole("button", { name: "閉じる" }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "メールでログイン" })).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        { Given: "利用規約モーダルが開いているとき", When: ["ログイン画面の利用規約モーダルで、モーダルの外側をクリックする"], Then: "モーダルが閉じる" },
      ],
    },
    async () => {
      const user = await renderLoginWithTermsModalOpen();

      await user.click(screen.getByTestId("terms-modal-backdrop"));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    },
  );
});
