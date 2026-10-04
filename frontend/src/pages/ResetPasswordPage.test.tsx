import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router";
import type { User } from "firebase/auth";
import { AuthContext } from "../contexts/AuthContext";
import { ResetPasswordPage } from "./ResetPasswordPage";

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

describe("[認証] パスワードの再設定", () => {
  describe("メールアドレスを入力して「再設定メールを送る」を押したとき", () => {
    describe("正常系", () => {
      it("入力したメールアドレス宛に再設定メールの送信が依頼される", async () => {
        const user = userEvent.setup();
        const resetPassword = vi.fn().mockResolvedValue(undefined);
        renderPage(resetPassword);

        await user.type(screen.getByPlaceholderText("メールアドレス"), "alice@example.com");
        await user.click(screen.getByRole("button", { name: "再設定メールを送る" }));

        expect(resetPassword).toHaveBeenCalledWith("alice@example.com");
      });

      describe("再設定メールの送信に成功したとき", () => {
        it("「メールを送信しました」を含む完了メッセージが表示される", async () => {
          const user = userEvent.setup();
          renderPage(vi.fn().mockResolvedValue(undefined));

          await user.type(screen.getByPlaceholderText("メールアドレス"), "alice@example.com");
          await user.click(screen.getByRole("button", { name: "再設定メールを送る" }));

          expect(screen.getByText(/メールを送信しました/)).toBeInTheDocument();
        });

        it("メールアドレスの入力フォームが表示されなくなる", async () => {
          const user = userEvent.setup();
          renderPage(vi.fn().mockResolvedValue(undefined));

          await user.type(screen.getByPlaceholderText("メールアドレス"), "alice@example.com");
          await user.click(screen.getByRole("button", { name: "再設定メールを送る" }));

          expect(screen.queryByTestId("reset-submit")).not.toBeInTheDocument();
        });
      });
    });

    describe("異常系", () => {
      describe("再設定メールの送信に失敗したとき", () => {
        it("「メールの送信に失敗しました」を含むエラーメッセージが表示される", async () => {
          const user = userEvent.setup();
          renderPage(vi.fn().mockRejectedValue(new Error("network")));

          await user.type(screen.getByPlaceholderText("メールアドレス"), "alice@example.com");
          await user.click(screen.getByRole("button", { name: "再設定メールを送る" }));

          expect(screen.getByText(/メールの送信に失敗しました/)).toBeInTheDocument();
        });

        it("メールアドレスの入力フォームが表示されたままになる", async () => {
          const user = userEvent.setup();
          renderPage(vi.fn().mockRejectedValue(new Error("network")));

          await user.type(screen.getByPlaceholderText("メールアドレス"), "alice@example.com");
          await user.click(screen.getByRole("button", { name: "再設定メールを送る" }));

          expect(screen.getByTestId("reset-submit")).toBeInTheDocument();
        });
      });
    });
  });
});
