import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { User } from "firebase/auth";
import { AuthContext } from "../contexts/AuthContext";
import { ResetPasswordPage } from "./ResetPasswordPage";

/**
 * ResetPasswordPage の仕様:
 * - 入力メールアドレスでリセットメール送信を依頼する
 * - 送信成功で完了メッセージを表示し、入力フォームを隠す
 * - 送信失敗でエラーメッセージを表示し、入力フォームを残す
 */
function renderPage(resetPassword: () => Promise<void>) {
  const auth = {
    user: null as User | null,
    loading: false,
    login: async () => {},
    signup: async () => {},
    loginWithGoogle: async () => {},
    resetPassword,
    logout: async () => {},
  };
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter>
        <ResetPasswordPage />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("[認証] パスワードリセット画面", () => {
  it("入力メールアドレスでリセットメール送信を依頼する", async () => {
    const user = userEvent.setup();
    const resetPassword = vi.fn().mockResolvedValue(undefined);
    renderPage(resetPassword);

    await user.type(screen.getByPlaceholderText("メールアドレス"), "alice@example.com");
    await user.click(screen.getByRole("button", { name: "再設定メールを送る" }));

    expect(resetPassword).toHaveBeenCalledWith("alice@example.com");
  });

  it("送信成功で完了メッセージを表示し、フォームを隠す", async () => {
    const user = userEvent.setup();
    renderPage(vi.fn().mockResolvedValue(undefined));

    await user.type(screen.getByPlaceholderText("メールアドレス"), "alice@example.com");
    await user.click(screen.getByRole("button", { name: "再設定メールを送る" }));

    expect(screen.getByText(/メールを送信しました/)).toBeInTheDocument();
    expect(screen.queryByTestId("reset-submit")).not.toBeInTheDocument();
  });

  it("送信失敗でエラーメッセージを表示し、フォームを残す", async () => {
    const user = userEvent.setup();
    renderPage(vi.fn().mockRejectedValue(new Error("network")));

    await user.type(screen.getByPlaceholderText("メールアドレス"), "alice@example.com");
    await user.click(screen.getByRole("button", { name: "再設定メールを送る" }));

    expect(screen.getByText(/メールの送信に失敗しました/)).toBeInTheDocument();
    expect(screen.getByTestId("reset-submit")).toBeInTheDocument();
  });
});
