import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, beforeEach, vi } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router";
import { AuthProvider } from "../../contexts/AuthContext";
import { LoginPage } from "../../pages/LoginPage";
import { ProtectedRoute } from "./ProtectedRoute";
import { defineCase } from "../../test/defineCase";

const firebase = vi.hoisted(() => ({
  auth: {},
  initialAuthState: null as unknown,
  notifyAuthState: null as ((user: unknown) => void) | null,
}));

vi.mock("../../lib/firebase", () => ({ requireAuth: () => firebase.auth }));
vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: class {},
  onAuthStateChanged: (_auth: unknown, notify: (user: unknown) => void) => {
    firebase.notifyAuthState = notify;
    if (firebase.initialAuthState !== "pending") notify(firebase.initialAuthState);
    return () => {};
  },
  signInWithEmailAndPassword: async () => {
    const user = { uid: "alice", emailVerified: true };
    firebase.notifyAuthState?.(user);
    return { user };
  },
}));

const SIGNED_IN_USER = { uid: "alice", emailVerified: true };

beforeEach(() => {
  firebase.initialAuthState = null;
});

function renderGuarded() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <p>保護対象の画面</p>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

const OPEN_PROTECTED_SCREEN = "ログイン必須の保護対象の画面を開く";
const NOT_SIGNED_IN = "ログインしていないとき";

describe("[共通:認証]ログイン必須画面の保護", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        { Given: "ログイン済みのとき", When: [OPEN_PROTECTED_SCREEN], Then: "保護対象の画面が表示される" },
      ],
    },
    async () => {
      firebase.initialAuthState = SIGNED_IN_USER;
      renderGuarded();

      expect(await screen.findByText("保護対象の画面")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "メールでログイン" })).not.toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "ログイン状態の確認が終わっていないとき",
          When: [OPEN_PROTECTED_SCREEN],
          Then: "「認証を確認中...」の表示のままになる",
        },
      ],
    },
    () => {
      firebase.initialAuthState = "pending";
      renderGuarded();

      expect(screen.getByRole("status", { name: "認証を確認中..." })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "メールでログイン" })).not.toBeInTheDocument();
      expect(screen.queryByText("保護対象の画面")).not.toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [{ Given: NOT_SIGNED_IN, When: [OPEN_PROTECTED_SCREEN], Then: "ログイン画面が表示される" }],
    },
    async () => {
      renderGuarded();

      expect(await screen.findByRole("button", { name: "メールでログイン" })).toBeInTheDocument();
      expect(screen.queryByText("保護対象の画面")).not.toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: NOT_SIGNED_IN,
          When: [OPEN_PROTECTED_SCREEN, "ログイン画面で、メールアドレスとパスワードを入力して「メールでログイン」を押す"],
          Then: "保護対象の画面が表示される",
        },
      ],
    },
    async () => {
      const user = userEvent.setup();
      renderGuarded();
      await user.type(await screen.findByPlaceholderText("メールアドレス"), "dummy@example.com");
      await user.type(screen.getByPlaceholderText("パスワード"), "dummy-pass");

      await user.click(screen.getByRole("button", { name: "メールでログイン" }));

      expect(await screen.findByText("保護対象の画面")).toBeInTheDocument();
    },
  );
});
