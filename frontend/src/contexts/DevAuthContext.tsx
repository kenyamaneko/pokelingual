import { type ReactNode } from "react";
import type { User } from "firebase/auth";
import { AuthContext } from "./AuthContext";

const devUser = {
  uid: "dev-user",
  displayName: "Dev User",
  email: "dev@example.com",
} as unknown as User;

export function DevAuthProvider({ children }: { children: ReactNode }) {
  return (
    <AuthContext.Provider
      value={{
        user: devUser,
        loading: false,
        login: async () => {},
        loginWithGoogle: async () => {},
        logout: async () => {},
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
