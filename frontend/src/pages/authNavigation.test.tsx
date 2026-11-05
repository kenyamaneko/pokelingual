import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router";
import type { User } from "firebase/auth";
import { AuthContext } from "../contexts/AuthContext";
import { TutorialProvider } from "../contexts/TutorialContext";
import { HomePage } from "./HomePage";
import { LoginPage } from "./LoginPage";
import { SignupPage } from "./SignupPage";
import { ResetPasswordPage } from "./ResetPasswordPage";
import { defineCase } from "../test/defineCase";

const START_QUEST_BUTTON = "ポケモンを探しに行く";

const unauthenticated = {
  user: null as User | null,
  loading: false,
  login: async () => {},
  signup: async () => {},
  loginWithGoogle: async () => {},
  resetPassword: async () => {},
  logout: async () => {},
};

// ログイン済みだと各画面がホームへ遷移してリンクの遷移を確かめられないため、既定は未ログインにする
function renderAuthRoutes(initialPath: string, user: User | null = null) {
  return render(
    <AuthContext.Provider value={{ ...unauthenticated, user }}>
      <TutorialProvider>
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
          </Routes>
        </MemoryRouter>
      </TutorialProvider>
    </AuthContext.Provider>,
  );
}

const authenticatedUser = { uid: "alice" } as unknown as User;

describe("[本体:認証]認証画面の遷移", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "ログインしていないとき",
          When: ["ログイン画面で、新規登録画面へ遷移する「アカウントを作る」リンクを押す"],
          Then: "新規登録画面の「アカウントを作成する」ボタンが表示される",
        },
      ],
    },
    async () => {
      const user = userEvent.setup();
      renderAuthRoutes("/login");

      await user.click(screen.getByRole("link", { name: "アカウントを作る" }));

      expect(screen.getByRole("button", { name: "アカウントを作成する" })).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "ログインしていないとき",
          When: ["ログイン画面で、パスワード再設定画面へ遷移する「再設定する」リンクを押す"],
          Then: "パスワード再設定画面の「再設定メールを送る」ボタンが表示される",
        },
      ],
    },
    async () => {
      const user = userEvent.setup();
      renderAuthRoutes("/login");

      await user.click(screen.getByRole("link", { name: "再設定する" }));

      expect(screen.getByRole("button", { name: "再設定メールを送る" })).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "ログインしていないとき",
          When: ["新規登録画面で、ログイン画面へ遷移する「ログイン」リンクを押す"],
          Then: "ログイン画面の「アカウントを作る」リンクが表示される",
        },
      ],
    },
    async () => {
      const user = userEvent.setup();
      renderAuthRoutes("/signup");

      await user.click(screen.getByRole("link", { name: "ログイン" }));

      expect(screen.getByRole("link", { name: "アカウントを作る" })).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "ログインしていないとき",
          When: ["パスワード再設定画面で、ログイン画面へ遷移する「ログインに戻る」リンクを押す"],
          Then: "ログイン画面の「アカウントを作る」リンクが表示される",
        },
      ],
    },
    async () => {
      const user = userEvent.setup();
      renderAuthRoutes("/reset-password");

      await user.click(screen.getByRole("link", { name: "ログインに戻る" }));

      expect(screen.getByRole("link", { name: "アカウントを作る" })).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "ログイン済みのとき",
          When: ["ログイン画面へ遷移する"],
          Then: "ホーム画面の「ポケモンを探しに行く」ボタンが表示される",
        },
      ],
    },
    async () => {
      renderAuthRoutes("/login", authenticatedUser);

      expect(await screen.findByRole("button", { name: START_QUEST_BUTTON })).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "ログイン済みのとき",
          When: ["新規登録画面へ遷移する"],
          Then: "ホーム画面の「ポケモンを探しに行く」ボタンが表示される",
        },
      ],
    },
    async () => {
      renderAuthRoutes("/signup", authenticatedUser);

      expect(await screen.findByRole("button", { name: START_QUEST_BUTTON })).toBeInTheDocument();
    },
  );
});
