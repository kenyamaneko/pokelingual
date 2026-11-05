import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { MemoryRouter, Routes, Route } from "react-router";
import type { User } from "firebase/auth";
import { AuthContext } from "../contexts/AuthContext";
import { TutorialProvider } from "../contexts/TutorialContext";
import { HomePage } from "./HomePage";
import { LoginPage } from "./LoginPage";
import { spec } from "../test/labels";
import { EmailNotVerifiedError } from "../utils/authErrors";

const START_QUEST_BUTTON = "ポケモンを探しに行く";

/**
 * Firebase 認証は外部との境界のため、AuthContext ごとモックする。ログイン後の遷移先のホーム画面は実物を使う。
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
        <TutorialProvider>
          <MemoryRouter initialEntries={["/login"]}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
            </Routes>
          </MemoryRouter>
        </TutorialProvider>
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

const CORRECT_PASSWORD = "dummy-password";

describe("[本体:認証]メールアドレスでのログイン", () => {
  describe("ログイン画面で、メールアドレスとパスワードを入力して「メールでログイン」を押すと", () => {
    describe("部品間結合テスト", () => {
      describe("正常系", () => {
        it("正しいメールアドレスとパスワードのとき、ホーム画面が表示される", async () => {
          const user = userEvent.setup();
          renderLogin(vi.fn().mockResolvedValue(undefined));

          await submitLogin(user, "dummy@example.com", CORRECT_PASSWORD);

          expect(await screen.findByRole("button", { name: START_QUEST_BUTTON })).toBeInTheDocument();
        });
      });

      describe("異常系", () => {
        it.each([
          [
            "メールアドレスが未確認のアカウントのとき",
            new EmailNotVerifiedError(),
            CORRECT_PASSWORD,
            /メールが未確認です/,
          ],
          [
            "メールアドレスまたはパスワードが間違っているとき",
            new Error("auth error"),
            "wrong-password",
            spec("メールアドレスまたはパスワードが間違っています"),
          ],
        ] as const)(
          "%s、ホーム画面が表示されない",
          async (_given, loginError, password, errorMessage) => {
            const user = userEvent.setup();
            renderLogin(vi.fn().mockRejectedValue(loginError));

            await submitLogin(user, "dummy@example.com", password);

            await screen.findByText(errorMessage);
            expect(screen.queryByRole("button", { name: START_QUEST_BUTTON })).not.toBeInTheDocument();
          },
        );
      });
    });
  });

  describe("メールアドレスが未確認のアカウントのとき", () => {
    describe("ログイン画面で、メールアドレスとパスワードを入力して「メールでログイン」を押すと", () => {
      describe("部品間結合テスト", () => {
        describe("異常系", () => {
          it("「メールが未確認です」を含む確認を促すメッセージが表示される", async () => {
            const user = userEvent.setup();
            renderLogin(vi.fn().mockRejectedValue(new EmailNotVerifiedError()));

            await submitLogin(user, "dummy@example.com", CORRECT_PASSWORD);

            expect(await screen.findByText(/メールが未確認です/)).toBeInTheDocument();
          });

          it("メールアドレスの確認が済んだあとにもう一度「メールでログイン」を押すと、ホーム画面が表示される", async () => {
            const user = userEvent.setup();
            renderLogin(
              vi
                .fn()
                .mockRejectedValueOnce(new EmailNotVerifiedError())
                .mockResolvedValue(undefined),
            );
            await submitLogin(user, "dummy@example.com", CORRECT_PASSWORD);
            await screen.findByText(/メールが未確認です/);

            await user.click(screen.getByRole("button", { name: "メールでログイン" }));

            expect(await screen.findByRole("button", { name: START_QUEST_BUTTON })).toBeInTheDocument();
          });
        });
      });
    });
  });

  describe("メールアドレスまたはパスワードが間違っているとき", () => {
    describe("ログイン画面で、メールアドレスとパスワードを入力して「メールでログイン」を押すと", () => {
      describe("部品間結合テスト", () => {
        describe("異常系", () => {
          it("「メールアドレスまたはパスワードが間違っています」と表示される", async () => {
            const user = userEvent.setup();
            renderLogin(vi.fn().mockRejectedValue(new Error("auth error")));

            await submitLogin(user, "dummy@example.com", "wrong-password");

            expect(
              await screen.findByText(spec("メールアドレスまたはパスワードが間違っています")),
            ).toBeInTheDocument();
          });

          it("「メールでログイン」ボタンがもう一度押せる状態のままになる", async () => {
            const user = userEvent.setup();
            renderLogin(vi.fn().mockRejectedValue(new Error("auth error")));

            await submitLogin(user, "dummy@example.com", "wrong-password");

            await screen.findByText(spec("メールアドレスまたはパスワードが間違っています"));
            expect(screen.getByRole("button", { name: "メールでログイン" })).toBeEnabled();
          });

          it("正しいパスワードに入力し直してもう一度「メールでログイン」を押すと、ホーム画面が表示される", async () => {
            const user = userEvent.setup();
            renderLogin(
              vi.fn().mockRejectedValueOnce(new Error("auth error")).mockResolvedValue(undefined),
            );
            await submitLogin(user, "dummy@example.com", "wrong-password");
            await screen.findByText(spec("メールアドレスまたはパスワードが間違っています"));

            await user.clear(screen.getByPlaceholderText("パスワード"));
            await user.type(screen.getByPlaceholderText("パスワード"), CORRECT_PASSWORD);
            await user.click(screen.getByRole("button", { name: "メールでログイン" }));

            expect(await screen.findByRole("button", { name: START_QUEST_BUTTON })).toBeInTheDocument();
          });
        });
      });
    });
  });
});

describe("[本体:サイト情報]ログイン画面の問い合わせ", () => {
  describe("部品間結合テスト", () => {
    describe("正常系", () => {
      it("ログイン画面を開くと、「問い合わせ」のリンク先は「https://forms.gle/mUhMjSMf8TPJc3CC9」で、新しいタブで開く", () => {
        renderLogin(vi.fn());

        const contact = screen.getByRole("link", { name: "問い合わせ" });
        expect(contact).toHaveAttribute("href", "https://forms.gle/mUhMjSMf8TPJc3CC9");
        expect(contact).toHaveAttribute("target", "_blank");
      });
    });
  });
});

describe("[本体:サイト情報]ログイン画面の利用規約", () => {
  describe("部品間結合テスト", () => {
    describe("正常系", () => {
      it("ログイン画面で「利用規約」を押すと、利用規約モーダルが表示される", async () => {
        const user = userEvent.setup();
        renderLogin(vi.fn());

        await user.click(screen.getByRole("button", { name: "利用規約" }));

        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });
    });
  });

  describe("利用規約モーダルが開いているとき", () => {
    async function renderLoginWithTermsModalOpen() {
      const user = userEvent.setup();
      renderLogin(vi.fn());
      await user.click(screen.getByRole("button", { name: "利用規約" }));
      return user;
    }

    describe("部品間結合テスト", () => {
      describe("正常系", () => {
        it("「閉じる」を押すと、モーダルが閉じてログイン画面が表示される", async () => {
          const user = await renderLoginWithTermsModalOpen();

          await user.click(screen.getByRole("button", { name: "閉じる" }));

          expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
          expect(screen.getByRole("button", { name: "メールでログイン" })).toBeInTheDocument();
        });

        it("モーダルの外側をクリックすると、モーダルが閉じる", async () => {
          const user = await renderLoginWithTermsModalOpen();

          await user.click(screen.getByTestId("terms-modal-backdrop"));

          expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        });
      });
    });
  });
});
