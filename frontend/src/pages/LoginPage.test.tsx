import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { User } from "firebase/auth";
import { AuthContext } from "../contexts/AuthContext";
import { LoginPage } from "./LoginPage";
import { spec } from "../test/labels";
import { CONTACT_FORM_URL } from "../constants/links";
import { EmailNotVerifiedError } from "../utils/authErrors";

/**
 * LoginPage の仕様:
 * - 入力したメールアドレスとパスワードでログインでき、成功するとホーム画面へ遷移する
 * - ログイン失敗 (認証エラー) 時はエラーメッセージを表示し、再入力できるようフォームを残す
 *
 * Firebase 認証は境界として AuthContext ごとモックする。
 * 認証画面間の遷移 (サインアップ・リセットへの導線) は authNavigation.test.tsx で検証する。
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
        // 認証成功で AuthContext の user が確定する本番挙動を模す (これで LoginPage はホームへ遷移する)
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

describe("ログイン画面", () => {
  it("メールアドレスとパスワードでログインするとホーム画面へ遷移する", async () => {
    const user = userEvent.setup();
    renderLogin(vi.fn().mockResolvedValue(undefined));

    await submitLogin(user, "dummy@example.com", "dummy-password");

    expect(await screen.findByTestId("home-page")).toBeInTheDocument();
  });

  it("ログインに失敗するとエラーメッセージが表示され、フォームは残る", async () => {
    const user = userEvent.setup();
    renderLogin(vi.fn().mockRejectedValue(new Error("auth error")));

    await submitLogin(user, "dummy@example.com", "dummy-password");

    expect(
      await screen.findByText(
        spec("メールアドレスまたはパスワードが間違っています"),
      ),
    ).toBeInTheDocument();
    // 再入力してやり直せるよう、送信ボタンが操作可能な状態で残る
    expect(screen.getByRole("button", { name: "メールでログイン" })).toBeEnabled();
    // 認証失敗ではホームへ遷移しない
    expect(screen.queryByTestId("home-page")).not.toBeInTheDocument();
  });

  it("メール未確認のログインでは、確認を促すメッセージを表示しホームへ遷移しない", async () => {
    const user = userEvent.setup();
    renderLogin(vi.fn().mockRejectedValue(new EmailNotVerifiedError()));

    await submitLogin(user, "dummy@example.com", "dummy-password");

    expect(await screen.findByText(/メールが未確認です/)).toBeInTheDocument();
    expect(screen.queryByTestId("home-page")).not.toBeInTheDocument();
  });
});

/**
 * ログイン前でも問い合わせ・利用規約に到達できる導線の仕様。
 */
describe("ログイン画面のサイト情報リンク", () => {
  it("問い合わせリンクが問い合わせフォームを新しいタブで開く", () => {
    renderLogin(vi.fn());
    const contact = screen.getByRole("link", { name: "問い合わせ" });
    expect(contact).toHaveAttribute("href", CONTACT_FORM_URL);
    expect(contact).toHaveAttribute("target", "_blank");
  });

  it("利用規約リンクが利用規約ページを指す", () => {
    renderLogin(vi.fn());
    expect(screen.getByRole("link", { name: "利用規約" })).toHaveAttribute("href", "/terms");
  });
});
