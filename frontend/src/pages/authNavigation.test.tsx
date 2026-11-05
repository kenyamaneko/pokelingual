import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router";
import type { User } from "firebase/auth";
import { AuthContext } from "../contexts/AuthContext";
import { TutorialProvider } from "../contexts/TutorialContext";
import { HomePage } from "./HomePage";
import { LoginPage } from "./LoginPage";
import { SignupPage } from "./SignupPage";
import { ResetPasswordPage } from "./ResetPasswordPage";

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
  describe("ログインしていないとき", () => {
    describe("部品間結合テスト", () => {
      describe("正常系", () => {
        it("ログイン画面で「アカウントを作る」リンクを押すと、新規登録画面の「アカウントを作成する」ボタンが表示される", async () => {
          const user = userEvent.setup();
          renderAuthRoutes("/login");

          await user.click(screen.getByRole("link", { name: "アカウントを作る" }));

          expect(screen.getByRole("button", { name: "アカウントを作成する" })).toBeInTheDocument();
        });

        it("ログイン画面で「再設定する」リンクを押すと、パスワード再設定画面の「再設定メールを送る」ボタンが表示される", async () => {
          const user = userEvent.setup();
          renderAuthRoutes("/login");

          await user.click(screen.getByRole("link", { name: "再設定する" }));

          expect(screen.getByRole("button", { name: "再設定メールを送る" })).toBeInTheDocument();
        });

        it("新規登録画面で「ログイン」リンクを押すと、ログイン画面の「アカウントを作る」リンクが表示される", async () => {
          const user = userEvent.setup();
          renderAuthRoutes("/signup");

          await user.click(screen.getByRole("link", { name: "ログイン" }));

          expect(screen.getByRole("link", { name: "アカウントを作る" })).toBeInTheDocument();
        });

        it("パスワード再設定画面で「ログインに戻る」リンクを押すと、ログイン画面の「アカウントを作る」リンクが表示される", async () => {
          const user = userEvent.setup();
          renderAuthRoutes("/reset-password");

          await user.click(screen.getByRole("link", { name: "ログインに戻る" }));

          expect(screen.getByRole("link", { name: "アカウントを作る" })).toBeInTheDocument();
        });
      });
    });
  });

  describe("ログイン済みのとき", () => {
    describe("部品間結合テスト", () => {
      describe("正常系", () => {
        it("ログイン画面を開くと、ホーム画面に遷移する", async () => {
          renderAuthRoutes("/login", authenticatedUser);

          expect(await screen.findByRole("button", { name: START_QUEST_BUTTON })).toBeInTheDocument();
        });

        it("新規登録画面を開くと、ホーム画面に遷移する", async () => {
          renderAuthRoutes("/signup", authenticatedUser);

          expect(await screen.findByRole("button", { name: START_QUEST_BUTTON })).toBeInTheDocument();
        });
      });
    });
  });
});
