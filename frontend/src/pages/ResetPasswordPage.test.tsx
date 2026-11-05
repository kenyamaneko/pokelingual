import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { AuthProvider } from "../contexts/AuthContext";
import { ResetPasswordPage } from "./ResetPasswordPage";

const firebase = vi.hoisted(() => ({
  auth: {},
  resetEmailRequests: [] as { email: string }[],
  resetEmailErrors: [] as Error[],
}));

vi.mock("../lib/firebase", () => ({ requireAuth: () => firebase.auth }));
vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: class {},
  onAuthStateChanged: (_auth: unknown, notify: (user: unknown) => void) => {
    notify(null);
    return () => {};
  },
  sendPasswordResetEmail: async (_auth: unknown, email: string) => {
    const error = firebase.resetEmailErrors.shift();
    if (error) throw error;
    firebase.resetEmailRequests.push({ email });
  },
}));

beforeEach(() => {
  firebase.resetEmailRequests.length = 0;
  firebase.resetEmailErrors.length = 0;
});

function renderPage() {
  return render(
    <AuthProvider>
      <MemoryRouter>
        <ResetPasswordPage />
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe("[本体:認証]パスワードの再設定", () => {
  describe("パスワード再設定画面で、メールアドレスを入力して「再設定メールを送る」を押すと", () => {
    describe("部品間結合テスト", () => {
      describe("正常系", () => {
        it("メールアドレスが「alice@example.com」のとき、Firebase Auth に「alice@example.com」宛の再設定メールの送信が依頼される", async () => {
          const user = userEvent.setup();
          renderPage();

          await user.type(screen.getByPlaceholderText("メールアドレス"), "alice@example.com");
          await user.click(screen.getByRole("button", { name: "再設定メールを送る" }));

          expect(firebase.resetEmailRequests).toEqual([{ email: "alice@example.com" }]);
        });
      });
    });
  });

  describe("再設定メールの送信に成功したとき", () => {
    describe("パスワード再設定画面で、メールアドレスを入力して「再設定メールを送る」を押すと", () => {
      describe("部品間結合テスト", () => {
        describe("正常系", () => {
          it("「メールを送信しました」を含む完了メッセージが表示される", async () => {
            const user = userEvent.setup();
            renderPage();

            await user.type(screen.getByPlaceholderText("メールアドレス"), "alice@example.com");
            await user.click(screen.getByRole("button", { name: "再設定メールを送る" }));

            expect(screen.getByText(/メールを送信しました/)).toBeInTheDocument();
          });

          it("メールアドレスの入力フォームが表示されなくなる", async () => {
            const user = userEvent.setup();
            renderPage();

            await user.type(screen.getByPlaceholderText("メールアドレス"), "alice@example.com");
            await user.click(screen.getByRole("button", { name: "再設定メールを送る" }));

            expect(screen.queryByPlaceholderText("メールアドレス")).not.toBeInTheDocument();
          });
        });
      });
    });
  });

  describe("再設定メールの送信に失敗したとき", () => {
    describe("パスワード再設定画面で、メールアドレスを入力して「再設定メールを送る」を押すと", () => {
      describe("部品間結合テスト", () => {
        describe("異常系", () => {
          it("「メールの送信に失敗しました」を含むエラーメッセージが表示される", async () => {
            const user = userEvent.setup();
            firebase.resetEmailErrors.push(new Error("network"));
            renderPage();

            await user.type(screen.getByPlaceholderText("メールアドレス"), "alice@example.com");
            await user.click(screen.getByRole("button", { name: "再設定メールを送る" }));

            expect(screen.getByText(/メールの送信に失敗しました/)).toBeInTheDocument();
          });

          it("メールアドレスの入力フォームが表示されたままになる", async () => {
            const user = userEvent.setup();
            firebase.resetEmailErrors.push(new Error("network"));
            renderPage();

            await user.type(screen.getByPlaceholderText("メールアドレス"), "alice@example.com");
            await user.click(screen.getByRole("button", { name: "再設定メールを送る" }));

            expect(screen.getByPlaceholderText("メールアドレス")).toBeInTheDocument();
          });

          it("送信できるようになったあと、もう一度「再設定メールを送る」を押すと、「メールを送信しました」を含む完了メッセージが表示される", async () => {
            const user = userEvent.setup();
            firebase.resetEmailErrors.push(new Error("network"));
            renderPage();
            await user.type(screen.getByPlaceholderText("メールアドレス"), "alice@example.com");
            await user.click(screen.getByRole("button", { name: "再設定メールを送る" }));
            await screen.findByText(/メールの送信に失敗しました/);

            await user.click(screen.getByRole("button", { name: "再設定メールを送る" }));

            expect(await screen.findByText(/メールを送信しました/)).toBeInTheDocument();
          });
        });
      });
    });
  });
});
