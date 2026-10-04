import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router";
import type { User } from "firebase/auth";
import { AuthContext } from "../contexts/AuthContext";
import { SignupPage } from "./SignupPage";
import { spec } from "../test/labels";

/**
 * Firebase 認証は外部との境界のため、AuthContext ごとモックする。
 * @param signup 認証境界となる signup 実装 (成功/失敗を差し込む)。
 * @returns レンダリング結果。
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
  await user.type(screen.getByPlaceholderText("メールアドレス"), "dummy@example.com");
  await user.type(screen.getByPlaceholderText("パスワード"), password);
  await user.type(screen.getByPlaceholderText("パスワード（確認）"), passwordConfirm);
  await user.click(screen.getByRole("button", { name: "アカウントを作成する" }));
}

describe("[認証] メールアドレスでの新規登録", () => {
  describe("正常系", () => {
    it("パスワードと「パスワード（確認）」が一致しているとき、「アカウントを作成する」を押すと、入力したメールアドレスとパスワードで登録が依頼される", async () => {
      const user = userEvent.setup();
      const signup = vi.fn().mockResolvedValue(undefined);
      renderPage(signup);

      await submitSignup(user, "dummy-pass-1", "dummy-pass-1");

      expect(signup).toHaveBeenCalledWith("dummy@example.com", "dummy-pass-1");
      expect(screen.queryByTestId("signup-error")).not.toBeInTheDocument();
    });

    it("登録に成功したとき、「確認メールを送りました」の案内画面が表示される", async () => {
      const user = userEvent.setup();
      renderPage(vi.fn().mockResolvedValue(undefined));

      await submitSignup(user, "dummy-pass-1", "dummy-pass-1");

      expect(await screen.findByText("確認メールを送りました")).toBeInTheDocument();
    });
  });

  describe("異常系", () => {
    describe("パスワードと「パスワード（確認）」が一致しないまま「アカウントを作成する」を押したとき", () => {
      it("「パスワードが一致しません」と表示される", async () => {
        const user = userEvent.setup();
        renderPage(vi.fn().mockResolvedValue(undefined));

        await submitSignup(user, "dummy-pass-1", "dummy-pass-2");

        expect(await screen.findByTestId("signup-error")).toHaveTextContent(
          spec("パスワードが一致しません"),
        );
      });

      it("登録が依頼されない", async () => {
        const user = userEvent.setup();
        const signup = vi.fn().mockResolvedValue(undefined);
        renderPage(signup);

        await submitSignup(user, "dummy-pass-1", "dummy-pass-2");

        await screen.findByTestId("signup-error");
        expect(signup).not.toHaveBeenCalled();
      });
    });

    it("すでに登録されているメールアドレスで「アカウントを作成する」を押すと、「既に登録されています」を含むメッセージが表示される", async () => {
      const user = userEvent.setup();
      renderPage(vi.fn().mockRejectedValue({ code: "auth/email-already-in-use" }));

      await submitSignup(user, "dummy-pass-1", "dummy-pass-1");

      expect(await screen.findByText(/既に登録されています/)).toBeInTheDocument();
    });
  });
});
