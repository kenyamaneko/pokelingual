import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { User } from "firebase/auth";
import type { AxiosResponse } from "axios";
import { AuthContext } from "../contexts/AuthContext";
import { settingsApi } from "../api/settingsApi";
import { SettingsPage } from "./SettingsPage";
import { spec } from "../test/labels";
import type { SettingsResponse } from "../../../shared/api-types/settings";

vi.mock("../api/settingsApi", () => ({
  settingsApi: {
    getSettings: vi.fn(),
    updateExcludedPokemon: vi.fn(),
  },
}));

const fakeUser = { uid: "alice", email: "alice@example.com" } as unknown as User;

/**
 * GET /settings が指定の除外 ID 一覧を返す状態をモックする。
 * @param ids 除外ポケモン ID の一覧。
 */
function mockGetSettings(ids: number[]) {
  vi.mocked(settingsApi.getSettings).mockResolvedValue({
    data: { excluded_pokemon_ids: ids },
  } as AxiosResponse<SettingsResponse>);
}

/**
 * ログイン済みの AuthContext と /settings ルートで SettingsPage を描画する。
 * @param logout ログアウト操作のスタブ。
 * @returns Testing Library の RenderResult。
 */
function renderSettings(logout: () => Promise<void> = async () => {}) {
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

/**
 * SettingsPage の遷移仕様:
 * - ログアウトボタン押下で logout を実行し、/login へ遷移する
 */
describe("SettingsPage の遷移仕様", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSettings([]);
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

/**
 * SettingsPage の除外ポケモン管理仕様:
 * - 設定の読み込みに失敗したらエラーメッセージを表示する
 * - ID を追加すると保存され、一覧に反映される
 * - さくじょを押すと一覧から取り除かれ、空状態の文言に戻る
 * - 保存に失敗したらエラーメッセージを表示し、一覧は変わらない
 *
 * ID の範囲・件数上限・重複のバリデーションは backend の責務のため、ここでは検証しない。
 */
describe("SettingsPage の除外ポケモン管理仕様", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("設定の読み込みに失敗するとエラーメッセージが表示される", async () => {
    vi.mocked(settingsApi.getSettings).mockRejectedValue(new Error("network down"));
    renderSettings();

    expect(
      await screen.findByText(spec("せっていの　読みこみに　しっぱいしました")),
    ).toBeInTheDocument();
  });

  it("ポケモン ID を追加すると保存され、一覧に表示される", async () => {
    mockGetSettings([]);
    vi.mocked(settingsApi.updateExcludedPokemon).mockResolvedValue(
      {} as AxiosResponse,
    );
    const user = userEvent.setup();
    renderSettings();

    await user.type(await screen.findByPlaceholderText("ポケモン ID"), "42");
    await user.click(screen.getByRole("button", { name: "ついか" }));

    // 追加した ID が 3 桁 0 埋めで一覧に現れ、空状態の文言が消える
    expect(await screen.findByText("#042")).toBeInTheDocument();
    expect(
      screen.queryByText(spec("じょがい　ポケモンは　いません")),
    ).not.toBeInTheDocument();
    // 保存 API には追加後の ID 一覧が渡る (保存された内容の確認)
    expect(settingsApi.updateExcludedPokemon).toHaveBeenCalledWith([42]);
  });

  it("さくじょを押すと一覧から取り除かれ、空状態の文言に戻る", async () => {
    mockGetSettings([42]);
    vi.mocked(settingsApi.updateExcludedPokemon).mockResolvedValue(
      {} as AxiosResponse,
    );
    const user = userEvent.setup();
    renderSettings();

    expect(await screen.findByText("#042")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "さくじょ" }));

    expect(
      await screen.findByText(spec("じょがい　ポケモンは　いません")),
    ).toBeInTheDocument();
    expect(screen.queryByText("#042")).not.toBeInTheDocument();
    // 保存 API には削除後の空一覧が渡る (保存された内容の確認)
    expect(settingsApi.updateExcludedPokemon).toHaveBeenCalledWith([]);
  });

  it("保存に失敗するとエラーメッセージが表示され、一覧は変わらない", async () => {
    mockGetSettings([]);
    vi.mocked(settingsApi.updateExcludedPokemon).mockRejectedValue(
      new Error("invalid id"),
    );
    const user = userEvent.setup();
    renderSettings();

    await user.type(await screen.findByPlaceholderText("ポケモン ID"), "42");
    await user.click(screen.getByRole("button", { name: "ついか" }));

    expect(
      await screen.findByText(
        spec("せっていを　ほぞんできなかったよ。ポケモン ID を　かくにんしてね"),
      ),
    ).toBeInTheDocument();
    // 保存に失敗した ID は一覧に反映されず、空状態のまま
    expect(screen.queryByText("#042")).not.toBeInTheDocument();
    expect(
      screen.getByText(spec("じょがい　ポケモンは　いません")),
    ).toBeInTheDocument();
  });
});
