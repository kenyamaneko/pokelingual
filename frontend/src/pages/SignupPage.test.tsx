import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { AuthProvider } from "../contexts/AuthContext";
import { SignupPage } from "./SignupPage";
import { spec } from "../test/labels";

const firebase = vi.hoisted(() => ({
  auth: {},
  accountCreationRequests: [] as { email: string; password: string }[],
  accountCreationErrors: [] as unknown[],
  notifyAuthState: null as ((user: unknown) => void) | null,
}));

vi.mock("../lib/firebase", () => ({ requireAuth: () => firebase.auth }));
vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: class {},
  onAuthStateChanged: (_auth: unknown, notify: (user: unknown) => void) => {
    firebase.notifyAuthState = notify;
    notify(null);
    return () => {};
  },
  createUserWithEmailAndPassword: async (_auth: unknown, email: string, password: string) => {
    const error = firebase.accountCreationErrors.shift();
    if (error) throw error;
    firebase.accountCreationRequests.push({ email, password });
    const user = { emailVerified: false };
    firebase.notifyAuthState?.(user);
    return { user };
  },
  sendEmailVerification: async () => {},
  signOut: async () => {
    firebase.notifyAuthState?.(null);
  },
}));

beforeEach(() => {
  firebase.accountCreationRequests.length = 0;
  firebase.accountCreationErrors.length = 0;
});

function renderPage() {
  return render(
    <AuthProvider>
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>
    </AuthProvider>,
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

describe("[本体:認証]メールアドレスでの新規登録", () => {
  describe("メールアドレスが「dummy@example.com」、パスワードと「パスワード（確認）」がどちらも「dummy-pass-1」で、登録に成功するとき", () => {
    describe("新規登録画面で、メールアドレス・パスワード・「パスワード（確認）」を入力して「アカウントを作成する」を押すと", () => {
      describe("部品間結合テスト", () => {
        describe("正常系", () => {
          it("Firebase Auth に「dummy@example.com」と「dummy-pass-1」でアカウントの作成が依頼される", async () => {
            const user = userEvent.setup();
            renderPage();

            await submitSignup(user, "dummy-pass-1", "dummy-pass-1");

            expect(firebase.accountCreationRequests).toEqual([
              { email: "dummy@example.com", password: "dummy-pass-1" },
            ]);
          });

          it("「確認メールを送りました」の案内画面が表示される", async () => {
            const user = userEvent.setup();
            renderPage();

            await submitSignup(user, "dummy-pass-1", "dummy-pass-1");

            expect(await screen.findByText("確認メールを送りました")).toBeInTheDocument();
          });

          it("エラーメッセージが表示されない", async () => {
            const user = userEvent.setup();
            renderPage();

            await submitSignup(user, "dummy-pass-1", "dummy-pass-1");

            await screen.findByText("確認メールを送りました");
            expect(screen.queryByTestId("signup-error")).not.toBeInTheDocument();
          });
        });
      });
    });
  });

  describe("すでに登録されているメールアドレスのとき", () => {
    describe("新規登録画面で、メールアドレス・パスワード・「パスワード（確認）」を入力して「アカウントを作成する」を押すと", () => {
      describe("部品間結合テスト", () => {
        describe("異常系", () => {
          it("「既に登録されています」を含むメッセージが表示される", async () => {
            const user = userEvent.setup();
            firebase.accountCreationErrors.push({ code: "auth/email-already-in-use" });
            renderPage();

            await submitSignup(user, "dummy-pass-1", "dummy-pass-1");

            expect(await screen.findByText(/既に登録されています/)).toBeInTheDocument();
          });

          it("別のメールアドレス「other@example.com」に入力し直してもう一度「アカウントを作成する」を押すと、「確認メールを送りました」の案内画面が表示される", async () => {
            const user = userEvent.setup();
            firebase.accountCreationErrors.push({ code: "auth/email-already-in-use" });
            renderPage();
            await submitSignup(user, "dummy-pass-1", "dummy-pass-1");
            await screen.findByText(/既に登録されています/);

            await user.clear(screen.getByPlaceholderText("メールアドレス"));
            await user.type(screen.getByPlaceholderText("メールアドレス"), "other@example.com");
            await user.click(screen.getByRole("button", { name: "アカウントを作成する" }));

            expect(await screen.findByText("確認メールを送りました")).toBeInTheDocument();
          });
        });
      });
    });
  });

  describe("パスワードと「パスワード（確認）」が一致しないとき", () => {
    describe("新規登録画面で、メールアドレス・パスワード・「パスワード（確認）」を入力して「アカウントを作成する」を押すと", () => {
      describe("部品間結合テスト", () => {
        describe("異常系", () => {
          it("「パスワードが一致しません」と表示される", async () => {
            const user = userEvent.setup();
            renderPage();

            await submitSignup(user, "dummy-pass-1", "dummy-pass-2");

            expect(await screen.findByTestId("signup-error")).toHaveTextContent(
              spec("パスワードが一致しません"),
            );
          });

          it("Firebase Auth にアカウントの作成が依頼されない", async () => {
            const user = userEvent.setup();
            renderPage();

            await submitSignup(user, "dummy-pass-1", "dummy-pass-2");

            await screen.findByTestId("signup-error");
            expect(firebase.accountCreationRequests).toEqual([]);
          });

          it("「パスワード（確認）」を「パスワード」と同じ「dummy-pass-1」に入力し直してもう一度「アカウントを作成する」を押すと、「確認メールを送りました」の案内画面が表示される", async () => {
            const user = userEvent.setup();
            renderPage();
            await submitSignup(user, "dummy-pass-1", "dummy-pass-2");
            await screen.findByTestId("signup-error");

            await user.clear(screen.getByPlaceholderText("パスワード（確認）"));
            await user.type(screen.getByPlaceholderText("パスワード（確認）"), "dummy-pass-1");
            await user.click(screen.getByRole("button", { name: "アカウントを作成する" }));

            expect(await screen.findByText("確認メールを送りました")).toBeInTheDocument();
          });
        });
      });
    });
  });
});
