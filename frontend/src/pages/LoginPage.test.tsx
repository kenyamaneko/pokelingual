import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { MemoryRouter, Routes, Route } from "react-router";
import type { User } from "firebase/auth";
import { AuthContext } from "../contexts/AuthContext";
import { LoginPage } from "./LoginPage";
import { spec } from "../test/labels";
import { EmailNotVerifiedError } from "../utils/authErrors";

/**
 * Firebase 認証は外部との境界のため、AuthContext ごとモックする。
 * @param login 認証境界となる login 実装 (成功/失敗を差し込む)。
 * @returns レンダリング結果。
 */
function renderLogin(login: (email: string, password: string) => Promise<void>) {
  function Harness() {
    const [user, setUser] = useState<User | null>(null);
    const auth = {
      user,
      loading: false,
      login: async (email: string, password: string) => {
        await login(email, password);
        // 認証の成功で AuthContext の user が確定する本番の動きに合わせるため、login 成功後に user を設定する
        setUser({ uid: "dummy-uid" } as unknown as User);
      },
      signup: async () => {},
      loginWithGoogle: async () => {},
      resetPassword: async () => {},
      logout: async () => {},
    };
    return (
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={["/login"]}>
          <Routes>
            <Route path="/" element={<div data-testid="home-page" />} />
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );
  }
  return render(<Harness />);
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
  await user.click(screen.getByRole("button", { name: "メールでログイン" }));
}

describe("[認証] メールアドレスでのログイン", () => {
  describe("正常系", () => {
    it("正しいメールアドレスとパスワードで「メールでログイン」を押すと、ホーム画面に遷移する", async () => {
      const user = userEvent.setup();
      renderLogin(vi.fn().mockResolvedValue(undefined));

      await submitLogin(user, "dummy@example.com", "dummy-password");

      expect(await screen.findByTestId("home-page")).toBeInTheDocument();
    });
  });

  describe("異常系", () => {
    describe("メールアドレスまたはパスワードが間違っていて「メールでログイン」を押したとき", () => {
      it("「メールアドレスまたはパスワードが間違っています」と表示される", async () => {
        const user = userEvent.setup();
        renderLogin(vi.fn().mockRejectedValue(new Error("auth error")));

        await submitLogin(user, "dummy@example.com", "dummy-password");

        expect(
          await screen.findByText(spec("メールアドレスまたはパスワードが間違っています")),
        ).toBeInTheDocument();
        expect(screen.queryByTestId("home-page")).not.toBeInTheDocument();
      });

      it("「メールでログイン」ボタンがもう一度押せる状態のままになる", async () => {
        const user = userEvent.setup();
        renderLogin(vi.fn().mockRejectedValue(new Error("auth error")));

        await submitLogin(user, "dummy@example.com", "dummy-password");

        await screen.findByText(spec("メールアドレスまたはパスワードが間違っています"));
        expect(screen.getByRole("button", { name: "メールでログイン" })).toBeEnabled();
      });
    });

    it("メールアドレスが未確認のアカウントで「メールでログイン」を押すと、「メールが未確認です」を含む確認を促すメッセージが表示される", async () => {
      const user = userEvent.setup();
      renderLogin(vi.fn().mockRejectedValue(new EmailNotVerifiedError()));

      await submitLogin(user, "dummy@example.com", "dummy-password");

      expect(await screen.findByText(/メールが未確認です/)).toBeInTheDocument();
      expect(screen.queryByTestId("home-page")).not.toBeInTheDocument();
    });
  });
});

describe("[サイト情報] ログイン画面の問い合わせ・利用規約", () => {
  describe("正常系", () => {
    it("ログイン画面を表示したとき、「問い合わせ」のリンクは問い合わせフォームを新しいタブで開くリンクになっている", () => {
      renderLogin(vi.fn());
      const contact = screen.getByRole("link", { name: "問い合わせ" });
      expect(contact).toHaveAttribute("href", "https://forms.gle/mUhMjSMf8TPJc3CC9");
      expect(contact).toHaveAttribute("target", "_blank");
    });

    it("ログイン画面で「利用規約」を押すと、利用規約モーダルが表示される", async () => {
      const user = userEvent.setup();
      renderLogin(vi.fn());

      await user.click(screen.getByRole("button", { name: "利用規約" }));

      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    describe("利用規約モーダルが開いているとき", () => {
      it("「閉じる」を押すと、モーダルが閉じてログイン画面が表示される", async () => {
        const user = userEvent.setup();
        renderLogin(vi.fn());
        await user.click(screen.getByRole("button", { name: "利用規約" }));

        await user.click(screen.getByRole("button", { name: "閉じる" }));

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "メールでログイン" })).toBeInTheDocument();
      });

      it("モーダルの外側をクリックすると、モーダルが閉じる", async () => {
        const user = userEvent.setup();
        renderLogin(vi.fn());
        await user.click(screen.getByRole("button", { name: "利用規約" }));

        await user.click(screen.getByTestId("terms-modal-backdrop"));

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });
  });
});
