import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { User } from "firebase/auth";
import { AuthContext } from "../../contexts/AuthContext";
import { ProtectedRoute } from "./ProtectedRoute";

/**
 * ProtectedRoute の仕様:
 * - 認証済み (user!=null) なら children を描画する
 * - 未認証 (user=null, loading=false) なら /login へリダイレクトする
 * - 認証状態の確定前 (loading=true) はリダイレクトも描画もせず、ローディングにとどまる
 */
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

describe("ProtectedRoute", () => {
  it("認証済みなら children を描画する", () => {
    renderGuarded({ user: fakeUser, loading: false });

    expect(screen.getByTestId("secret-page")).toBeInTheDocument();
    expect(screen.queryByTestId("login-page")).not.toBeInTheDocument();
  });

  it("未認証なら /login へリダイレクトする", () => {
    renderGuarded({ user: null, loading: false });

    expect(screen.getByTestId("login-page")).toBeInTheDocument();
    expect(screen.queryByTestId("secret-page")).not.toBeInTheDocument();
  });

  it("認証状態の確定前はリダイレクトせずローディングにとどまる", () => {
    renderGuarded({ user: null, loading: true });

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByTestId("login-page")).not.toBeInTheDocument();
    expect(screen.queryByTestId("secret-page")).not.toBeInTheDocument();
  });
});
