import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";
import { EmailNotVerifiedError } from "../utils/authErrors";

/**
 * AuthContext の本人確認まわりの仕様 (メール登録は確認必須) を、外部境界の firebase/auth を
 * モックして確かめる。確認の強制は AuthContext のロジックなので、投げられる例外とサインアウトの
 * 有無 (観測できる結果) で検証する。
 */
const mocks = vi.hoisted(() => ({
  createUser: vi.fn(),
  signIn: vi.fn(),
  sendVerification: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("../firebase", () => ({ requireAuth: () => ({}) }));
vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: class {},
  createUserWithEmailAndPassword: mocks.createUser,
  signInWithEmailAndPassword: mocks.signIn,
  sendEmailVerification: mocks.sendVerification,
  signOut: mocks.signOut,
  sendPasswordResetEmail: vi.fn(),
  signInWithPopup: vi.fn(),
  onAuthStateChanged: (_auth: unknown, cb: (u: unknown) => void) => {
    cb(null);
    return () => {};
  },
}));

function renderAuth() {
  return renderHook(() => useAuth(), { wrapper: AuthProvider }).result;
}

describe("AuthContext のメール本人確認", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sendVerification.mockResolvedValue(undefined);
    mocks.signOut.mockResolvedValue(undefined);
  });

  it("メール登録は確認メールを送ってからサインアウトする", async () => {
    mocks.createUser.mockResolvedValue({ user: { emailVerified: false } });

    await renderAuth().current.signup("dummy@example.com", "dummy-pass");

    expect(mocks.sendVerification).toHaveBeenCalled();
    expect(mocks.signOut).toHaveBeenCalled();
  });

  it("未確認ユーザーのログインは EmailNotVerifiedError を投げ、サインアウトする", async () => {
    mocks.signIn.mockResolvedValue({ user: { emailVerified: false } });

    const auth = renderAuth();

    await expect(auth.current.login("dummy@example.com", "dummy-pass")).rejects.toBeInstanceOf(
      EmailNotVerifiedError,
    );
    expect(mocks.signOut).toHaveBeenCalled();
  });

  it("確認済みユーザーのログインは成功し、サインアウトしない", async () => {
    mocks.signIn.mockResolvedValue({ user: { emailVerified: true } });

    const auth = renderAuth();

    await expect(
      auth.current.login("dummy@example.com", "dummy-pass"),
    ).resolves.toBeUndefined();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
});
