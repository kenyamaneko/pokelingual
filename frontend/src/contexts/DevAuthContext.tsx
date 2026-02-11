import { type ReactNode } from "react";
import { AuthContext } from "./AuthContext";

const devUser = {
  uid: "dev-user",
  displayName: "Dev User",
  email: "dev@example.com",
} as any;

export function DevAuthProvider({ children }: { children: ReactNode }) {
  return (
    <AuthContext.Provider
      value={{
        user: devUser,
        loading: false,
        loginWithGoogle: async () => {},
        logout: async () => {},
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
