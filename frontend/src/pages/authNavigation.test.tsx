import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router";
import type { User } from "firebase/auth";
import { AuthContext } from "../contexts/AuthContext";
import { LoginPage } from "./LoginPage";
import { SignupPage } from "./SignupPage";
import { ResetPasswordPage } from "./ResetPasswordPage";

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

describe("[認証] 認証画面の遷移", () => {
  describe("正常系", () => {
    describe("ログインしていないとき", () => {
      it("ログイン画面の「アカウントを作る」リンクを押すと、新規登録画面が表示される", async () => {
        const user = userEvent.setup();
        renderAuthRoutes("/login");

        await user.click(screen.getByRole("link", { name: "アカウントを作る" }));

        expect(screen.getByRole("button", { name: "アカウントを作成する" })).toBeInTheDocument();
      });

      it("ログイン画面の「再設定する」リンクを押すと、パスワード再設定画面が表示される", async () => {
        const user = userEvent.setup();
        renderAuthRoutes("/login");

        await user.click(screen.getByRole("link", { name: "再設定する" }));

        expect(screen.getByRole("button", { name: "再設定メールを送る" })).toBeInTheDocument();
      });

      it("新規登録画面の「ログイン」リンクを押すと、ログイン画面が表示される", async () => {
        const user = userEvent.setup();
        renderAuthRoutes("/signup");

        await user.click(screen.getByRole("link", { name: "ログイン" }));

        expect(screen.getByRole("link", { name: "アカウントを作る" })).toBeInTheDocument();
      });

      it("パスワード再設定画面の「ログインに戻る」リンクを押すと、ログイン画面が表示される", async () => {
        const user = userEvent.setup();
        renderAuthRoutes("/reset-password");

        await user.click(screen.getByRole("link", { name: "ログインに戻る" }));

        expect(screen.getByRole("link", { name: "アカウントを作る" })).toBeInTheDocument();
      });
    });
  });

  describe("異常系", () => {
    describe("ログイン済みのとき", () => {
      it("ログイン画面を開くと、ホーム画面に遷移する", async () => {
        renderAuthRoutes("/login", authenticatedUser);

        expect(await screen.findByTestId("home-page")).toBeInTheDocument();
      });

      it("新規登録画面を開くと、ホーム画面に遷移する", async () => {
        renderAuthRoutes("/signup", authenticatedUser);

        expect(await screen.findByTestId("home-page")).toBeInTheDocument();
      });
    });
  });
});
