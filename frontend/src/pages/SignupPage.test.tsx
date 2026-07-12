import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { User } from "firebase/auth";
import { AuthContext } from "../contexts/AuthContext";
import { SignupPage } from "./SignupPage";
import { spec } from "../test/labels";

/**
 * SignupPage の仕様:
 * - パスワードと確認入力が一致しないときはエラーを表示し、登録を依頼しない
 * - 一致していれば入力したメールアドレスとパスワードで登録を依頼する
 *
 * Firebase 認証は境界として AuthContext ごとモックする。
 * 画面間遷移と登録成功後のリダイレクトは authNavigation.test.tsx で検証済み。
 */
function renderPage(signup: (email: string, password: string) => Promise<void>) {
  const auth = {
    user: null as User | null,
    loading: false,
    login: async () => {},
    signup,
    loginWithGoogle: async () => {},
    resetPassword: async () => {},
    logout: async () => {},
  };
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

/**
 * メールアドレス・パスワード・確認入力を埋めて登録を実行する。
 * @param user userEvent のセッション。
 * @param password 入力するパスワード。
 * @param passwordConfirm 入力する確認用パスワード。
 */
async function submitSignup(
  user: ReturnType<typeof userEvent.setup>,
  password: string,
  passwordConfirm: string,
) {
  await user.type(screen.getByTestId("signup-email"), "dummy@example.com");
  await user.type(screen.getByTestId("signup-password"), password);
  await user.type(screen.getByTestId("signup-password-confirm"), passwordConfirm);
  await user.click(screen.getByTestId("signup-submit"));
}

describe("新規登録画面", () => {
  it("パスワードと確認入力が一致しないとエラーを表示し、登録を依頼しない", async () => {
    const user = userEvent.setup();
    const signup = vi.fn().mockResolvedValue(undefined);
    renderPage(signup);

    await submitSignup(user, "dummy-pass-1", "dummy-pass-2");

    expect(await screen.findByTestId("signup-error")).toHaveTextContent(
      spec("パスワードが一致しません"),
    );
    // 不一致はクライアントで弾かれ、認証境界に登録リクエストが飛ばない
    expect(signup).not.toHaveBeenCalled();
  });

  it("パスワードと確認入力が一致していれば入力内容で登録を依頼する", async () => {
    const user = userEvent.setup();
    const signup = vi.fn().mockResolvedValue(undefined);
    renderPage(signup);

    await submitSignup(user, "dummy-pass-1", "dummy-pass-1");

    expect(signup).toHaveBeenCalledWith("dummy@example.com", "dummy-pass-1");
    expect(screen.queryByTestId("signup-error")).not.toBeInTheDocument();
  });

  it("登録に成功すると、確認メールの案内画面を表示する", async () => {
    const user = userEvent.setup();
    renderPage(vi.fn().mockResolvedValue(undefined));

    await submitSignup(user, "dummy-pass-1", "dummy-pass-1");

    expect(await screen.findByTestId("signup-verify-message")).toBeInTheDocument();
  });

  it("既に登録済みのメールでは、登録済みである旨を表示する", async () => {
    const user = userEvent.setup();
    renderPage(vi.fn().mockRejectedValue({ code: "auth/email-already-in-use" }));

    await submitSignup(user, "dummy-pass-1", "dummy-pass-1");

    expect(await screen.findByText(/既に登録されています/)).toBeInTheDocument();
  });
});
