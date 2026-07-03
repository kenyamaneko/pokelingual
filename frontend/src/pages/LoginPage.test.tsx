import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { User } from "firebase/auth";
import { AuthContext } from "../contexts/AuthContext";
import { LoginPage } from "./LoginPage";
import { spec } from "../test/labels";

/**
 * LoginPage の仕様:
 * - 入力したメールアドレスとパスワードでログインを依頼する
 * - ログイン失敗 (認証エラー) 時はエラーメッセージを表示し、再入力できるようフォームを残す
 *
 * Firebase 認証は境界として AuthContext ごとモックする。
 * 画面間遷移とログイン成功後のリダイレクトは authNavigation.test.tsx で検証済み。
 */
function renderPage(login: (email: string, password: string) => Promise<void>) {
  const auth = {
    user: null as User | null,
    loading: false,
    login,
    signup: async () => {},
    loginWithGoogle: async () => {},
    resetPassword: async () => {},
    logout: async () => {},
  };
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
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
  await user.click(screen.getByRole("button", { name: "メールで　ログイン" }));
}

describe("LoginPage の仕様", () => {
  it("入力したメールアドレスとパスワードでログインを依頼する", async () => {
    const user = userEvent.setup();
    const login = vi.fn().mockResolvedValue(undefined);
    renderPage(login);

    await submitLogin(user, "dummy@example.com", "dummy-password");

    expect(login).toHaveBeenCalledWith("dummy@example.com", "dummy-password");
  });

  it("ログインに失敗するとエラーメッセージが表示され、フォームは残る", async () => {
    const user = userEvent.setup();
    renderPage(vi.fn().mockRejectedValue(new Error("auth error")));

    await submitLogin(user, "dummy@example.com", "dummy-password");

    expect(
      await screen.findByText(
        spec("メールアドレス　または　パスワードが　正しくありません"),
      ),
    ).toBeInTheDocument();
    // 再入力してやり直せるよう、送信ボタンが操作可能な状態で残る
    expect(screen.getByRole("button", { name: "メールで　ログイン" })).toBeEnabled();
  });
});
