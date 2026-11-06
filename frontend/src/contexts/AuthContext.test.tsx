import { renderHook, act } from "@testing-library/react";
import { describe, expect, vi, beforeEach } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";
import { EmailNotVerifiedError } from "../utils/authErrors";
import { defineCase } from "../test/defineCase";

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

const LOGIN = "ログインする";
const CONFIRM_EMAIL = "メールアドレスの確認を済ませる";
const UNVERIFIED_EMAIL = "メールアドレスの確認が済んでいないとき";

describe("[共通:認証]メール本人確認", () => {
  beforeEach(() => {
    h.signInResult = null;
  });

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          When: ["新規登録する"],
          Then: "ログインしていない状態になる",
        },
      ],
    },
    async () => {
      const auth = renderAuth();

      await act(async () => {
        await auth.current.signup("dummy@example.com", "dummy-pass");
      });

      expect(auth.current.user).toBeNull();
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: "メールアドレスの確認が済んでいるとき", When: [LOGIN], Then: "ログイン済みの状態になる" }],
    },
    async () => {
      h.signInResult = { emailVerified: true };
      const auth = renderAuth();

      await act(async () => {
        await auth.current.login("dummy@example.com", "dummy-pass");
      });

      expect(auth.current.user).toEqual({ emailVerified: true });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      steps: [{ Given: UNVERIFIED_EMAIL, When: [LOGIN], Then: "メールアドレスの確認が済んでいないことを示すエラーになる" }],
    },
    async () => {
      h.signInResult = { emailVerified: false };
      const auth = renderAuth();

      await act(async () => {
        await expect(
          auth.current.login("dummy@example.com", "dummy-pass"),
        ).rejects.toBeInstanceOf(EmailNotVerifiedError);
      });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      steps: [{ Given: UNVERIFIED_EMAIL, When: [LOGIN], Then: "ログインしていない状態のままになる" }],
    },
    async () => {
      h.signInResult = { emailVerified: false };
      const auth = renderAuth();

      await act(async () => {
        await auth.current.login("dummy@example.com", "dummy-pass").catch(() => {});
      });

      expect(auth.current.user).toBeNull();
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      観点: ["回復確認"],
      steps: [
        {
          Given: UNVERIFIED_EMAIL,
          When: [LOGIN, CONFIRM_EMAIL, LOGIN],
          Then: "ログイン済みの状態になる",
        },
      ],
    },
    async () => {
      h.signInResult = { emailVerified: false };
      const auth = renderAuth();
      await act(async () => {
        await auth.current.login("dummy@example.com", "dummy-pass").catch(() => {});
      });
      h.signInResult = { emailVerified: true };

      await act(async () => {
        await auth.current.login("dummy@example.com", "dummy-pass");
      });

      expect(auth.current.user).toEqual({ emailVerified: true });
    },
  );
});
