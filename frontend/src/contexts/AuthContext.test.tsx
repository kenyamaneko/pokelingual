import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";
import { EmailNotVerifiedError } from "../utils/authErrors";

const h = vi.hoisted(() => ({
  auth: {},
  notify: null as ((user: unknown) => void) | null,
  signInResult: null as { emailVerified: boolean } | null,
}));

vi.mock("../lib/firebase", () => ({ requireAuth: () => h.auth }));
vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: class {},
  onAuthStateChanged: (_auth: unknown, cb: (user: unknown) => void) => {
    h.notify = cb;
    cb(null);
    return () => {};
  },
  createUserWithEmailAndPassword: async () => {
    const user = { emailVerified: false };
    h.notify?.(user);
    return { user };
  },
  signInWithEmailAndPassword: async () => {
    h.notify?.(h.signInResult);
    return { user: h.signInResult };
  },
  sendEmailVerification: async () => {},
  signOut: async () => {
    h.notify?.(null);
  },
  sendPasswordResetEmail: async () => {},
  signInWithPopup: async () => {},
}));

function renderAuth() {
  return renderHook(() => useAuth(), { wrapper: AuthProvider }).result;
}

describe("[認証] メール本人確認", () => {
  beforeEach(() => {
    h.signInResult = null;
  });

  describe("正常系", () => {
    it("メールアドレスとパスワードで新規登録すると、ログインしていない状態になる", async () => {
      const auth = renderAuth();

      await act(async () => {
        await auth.current.signup("dummy@example.com", "dummy-pass");
      });

      expect(auth.current.user).toBeNull();
    });

    it("メールの確認が済んでいるとき、ログインすると、ログイン済みの状態になる", async () => {
      h.signInResult = { emailVerified: true };
      const auth = renderAuth();

      await act(async () => {
        await auth.current.login("dummy@example.com", "dummy-pass");
      });

      expect(auth.current.user).not.toBeNull();
    });
  });

  describe("異常系", () => {
    describe("メールの確認が済んでいないとき", () => {
      beforeEach(() => {
        h.signInResult = { emailVerified: false };
      });

      it("ログインすると、メール未確認のエラーで失敗する", async () => {
        const auth = renderAuth();

        await act(async () => {
          await expect(
            auth.current.login("dummy@example.com", "dummy-pass"),
          ).rejects.toBeInstanceOf(EmailNotVerifiedError);
        });
      });

      it("ログインすると、ログインしていない状態のままになる", async () => {
        const auth = renderAuth();

        await act(async () => {
          await auth.current.login("dummy@example.com", "dummy-pass").catch(() => {});
        });

        expect(auth.current.user).toBeNull();
      });
    });
  });
});
