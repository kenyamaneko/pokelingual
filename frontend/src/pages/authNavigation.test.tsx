import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { User } from "firebase/auth";
import { AuthContext } from "../contexts/AuthContext";
import { LoginPage } from "./LoginPage";
import { SignupPage } from "./SignupPage";
import { ResetPasswordPage } from "./ResetPasswordPage";

/**
 * 認証画面間の遷移仕様:
 * - ログイン画面からサインアップ画面・パスワードリセット画面へ行ける
 * - サインアップ画面・パスワードリセット画面からログイン画面へ戻れる
 *
 * 未ログイン状態 (user=null) を前提とする。ログイン済みだと各画面はホームへ
 * リダイレクトするため、遷移リンク自体を検証できないため。
 */
const unauthenticated = {
  user: null as User | null,
  loading: false,
  login: async () => {},
  signup: async () => {},
  loginWithGoogle: async () => {},
  resetPassword: async () => {},
  logout: async () => {},
};

function renderAuthRoutes(initialPath: string, user: User | null = null) {
  return render(
    <AuthContext.Provider value={{ ...unauthenticated, user }}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/" element={<div data-testid="home-page" />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

const authenticatedUser = { uid: "alice" } as unknown as User;

describe("[認証] 認証画面間の遷移", () => {
  it("ログイン画面からサインアップ画面へ行ける", async () => {
    const user = userEvent.setup();
    renderAuthRoutes("/login");

    await user.click(screen.getByTestId("goto-signup"));

    expect(screen.getByTestId("signup-submit")).toBeInTheDocument();
  });

  it("ログイン画面からパスワードリセット画面へ行ける", async () => {
    const user = userEvent.setup();
    renderAuthRoutes("/login");

    await user.click(screen.getByTestId("goto-reset-password"));

    expect(screen.getByTestId("reset-submit")).toBeInTheDocument();
  });

  it("サインアップ画面からログイン画面へ戻れる", async () => {
    const user = userEvent.setup();
    renderAuthRoutes("/signup");

    await user.click(screen.getByTestId("goto-login"));

    expect(screen.getByTestId("goto-signup")).toBeInTheDocument();
  });

  it("パスワードリセット画面からログイン画面へ戻れる", async () => {
    const user = userEvent.setup();
    renderAuthRoutes("/reset-password");

    await user.click(screen.getByTestId("goto-login"));

    expect(screen.getByTestId("goto-signup")).toBeInTheDocument();
  });
});

/**
 * ログイン済みユーザーが認証画面を開いたときの遷移仕様:
 * - ログイン/サインアップ成功で user が確定すると、各画面はホーム (/) へリダイレクトする
 *   (ログイン・登録成功後にホームへ着地する導線そのもの)
 */
describe("[認証] ログイン済みユーザーが認証画面を開いたときの遷移", () => {
  it("認証済みでログイン画面を開くと、ホーム画面へ遷移する", async () => {
    renderAuthRoutes("/login", authenticatedUser);

    expect(await screen.findByTestId("home-page")).toBeInTheDocument();
  });

  it("認証済みでサインアップ画面を開くと、ホーム画面へ遷移する", async () => {
    renderAuthRoutes("/signup", authenticatedUser);

    expect(await screen.findByTestId("home-page")).toBeInTheDocument();
  });
});
