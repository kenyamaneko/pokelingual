import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";
import { EmailNotVerifiedError } from "../utils/authErrors";

/**
 * AuthContext のメール本人確認の仕様 (メール登録は確認が済むまでログインできない) を、
 * 外部境界の firebase/auth をモックして確かめる。firebase の認証状態変化をモックへ反映させ、
 * ログインできるか (公開状態の user と login の成否) という観測できる結果で検証する。
 */
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

  it("メール登録の直後はログインしていない（確認してから改めてログインする）", async () => {
    const auth = renderAuth();

    await act(async () => {
      await auth.current.signup("dummy@example.com", "dummy-pass");
    });

    expect(auth.current.user).toBeNull();
  });

  it("確認前のメールではログインできない", async () => {
    h.signInResult = { emailVerified: false };
    const auth = renderAuth();

    await act(async () => {
      await expect(
        auth.current.login("dummy@example.com", "dummy-pass"),
      ).rejects.toBeInstanceOf(EmailNotVerifiedError);
    });

    expect(auth.current.user).toBeNull();
  });

  it("確認済みのメールならログインできる", async () => {
    h.signInResult = { emailVerified: true };
    const auth = renderAuth();

    await act(async () => {
      await auth.current.login("dummy@example.com", "dummy-pass");
    });

    expect(auth.current.user).not.toBeNull();
  });
});
