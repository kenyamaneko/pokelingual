import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { User } from "firebase/auth";
import { AuthContext } from "../contexts/AuthContext";
import { settingsApi } from "../api/settingsApi";
import { SettingsPage } from "./SettingsPage";

vi.mock("../api/settingsApi", () => ({
  settingsApi: {
    getSettings: vi.fn(),
    updateExcludedPokemon: vi.fn(),
  },
}));

/**
 * SettingsPage の遷移仕様:
 * - ログアウトボタン押下で logout を実行し、/login へ遷移する
 *
 * 除外ポケモン管理 (追加/削除) は別関心のためここでは検証しない。
 */
const fakeUser = { uid: "alice", email: "alice@example.com" } as unknown as User;

function renderSettings(logout: () => Promise<void>) {
  const auth = {
    user: fakeUser,
    loading: false,
    login: async () => {},
    signup: async () => {},
    loginWithGoogle: async () => {},
    resetPassword: async () => {},
    logout,
  };
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={["/settings"]}>
        <Routes>
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/login" element={<div data-testid="login-page" />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe("SettingsPage の遷移仕様", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(settingsApi.getSettings).mockResolvedValue({
      data: {
        excluded_pokemon_ids: [],
      },
      status: 200,
      statusText: "OK",
      headers: {},
      // テスト用のダミー config。実装で参照されないため最小構成。
      config: { headers: {} } as Awaited<ReturnType<typeof settingsApi.getSettings>>["config"],
    } as Awaited<ReturnType<typeof settingsApi.getSettings>>);
  });

  it("ログアウト押下で logout を実行し /login へ遷移する", async () => {
    const user = userEvent.setup();
    const logout = vi.fn().mockResolvedValue(undefined);
    renderSettings(logout);

    // 設定読み込み完了 (loading スピナーが消える) を待ってから操作する
    const logoutButton = await screen.findByRole("button", { name: "ログアウト" });
    await user.click(logoutButton);

    expect(logout).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(screen.getByTestId("login-page")).toBeInTheDocument();
    });
  });
});
