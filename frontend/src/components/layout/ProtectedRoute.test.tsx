import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router";
import type { User } from "firebase/auth";
import { AuthContext } from "../../contexts/AuthContext";
import { ProtectedRoute } from "./ProtectedRoute";

const fakeUser = { uid: "alice" } as unknown as User;

function renderGuarded(auth: { user: User | null; loading: boolean }) {
  const value = {
    ...auth,
    login: async () => {},
    signup: async () => {},
    loginWithGoogle: async () => {},
    resetPassword: async () => {},
    logout: async () => {},
  };
  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={["/secret"]}>
        <Routes>
          <Route path="/login" element={<div data-testid="login-page" />} />
          <Route
            path="/secret"
            element={
              <ProtectedRoute>
                <div data-testid="secret-page" />
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("[認証] ログイン必須画面の保護", () => {
  describe("正常系", () => {
    it("ログイン済みのとき、保護対象の画面が表示される", () => {
      renderGuarded({ user: fakeUser, loading: false });

      expect(screen.getByTestId("secret-page")).toBeInTheDocument();
      expect(screen.queryByTestId("login-page")).not.toBeInTheDocument();
    });

    it("ログイン状態の確認が終わっていないとき、「認証を確認中...」の表示のままになる", () => {
      renderGuarded({ user: null, loading: true });

      expect(screen.getByRole("status", { name: "認証を確認中..." })).toBeInTheDocument();
      expect(screen.queryByTestId("login-page")).not.toBeInTheDocument();
      expect(screen.queryByTestId("secret-page")).not.toBeInTheDocument();
    });
  });

  describe("異常系", () => {
    it("ログインしていないとき、保護対象の画面を開くと、ログイン画面が表示される", () => {
      renderGuarded({ user: null, loading: false });

      expect(screen.getByTestId("login-page")).toBeInTheDocument();
      expect(screen.queryByTestId("secret-page")).not.toBeInTheDocument();
    });
  });
});
