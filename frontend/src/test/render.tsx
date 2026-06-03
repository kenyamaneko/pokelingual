import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import type { ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";
import type { User } from "firebase/auth";
import { AuthContext } from "../contexts/AuthContext";
import { UsageProvider } from "../contexts/UsageContext";

interface ProviderOptions extends Omit<RenderOptions, "wrapper"> {
  user?: User | null;
  withRouter?: boolean;
}

/** AuthContext + UsageProvider (+ 任意で BrowserRouter) を被せてレンダーするテスト用ヘルパー。 */
export function renderWithProviders(
  ui: ReactNode,
  options: ProviderOptions = {},
): RenderResult {
  const { user = null, withRouter = false, ...rest } = options;
  const auth = {
    user,
    loading: false,
    login: async () => {},
    signup: async () => {},
    loginWithGoogle: async () => {},
    resetPassword: async () => {},
    logout: async () => {},
  };
  const tree = (
    <AuthContext.Provider value={auth}>
      <UsageProvider>{ui}</UsageProvider>
    </AuthContext.Provider>
  );
  return render(withRouter ? <BrowserRouter>{tree}</BrowserRouter> : tree, rest);
}
