import { type ReactNode } from "react";
import type { User } from "firebase/auth";
import { AuthContext } from "./AuthContext";

const devUser = {
  uid: "dev-user",
  displayName: "Dev User",
  email: "dev@example.com",
} as unknown as User;

/**
 * 開発モード用に固定ユーザでログイン済みとして振る舞う AuthContext プロバイダ。
 * @param props children を含む React props。
 * @returns 固定ユーザを供給する AuthContext.Provider。
 */
export function DevAuthProvider({ children }: { children: ReactNode }) {
  return (
    <AuthContext.Provider
      value={{
        user: devUser,
        loading: false,
        login: async () => {},
        signup: async () => {},
        loginWithGoogle: async () => {},
        resetPassword: async () => {},
        logout: async () => {},
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
