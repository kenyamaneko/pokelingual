import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { User } from "firebase/auth";
import { AuthContext } from "../contexts/AuthContext";
import { server, apiUrl } from "../test/mswServer";
import { SettingsPage } from "./SettingsPage";
import { spec } from "../test/labels";
import { CONTACT_FORM_URL } from "../constants/links";

const fakeUser = { uid: "alice", email: "alice@example.com" } as unknown as User;

// PUT /settings/excluded-pokemon で実際に送られたボディ (保存内容) を HTTP 境界で捕捉する。
let lastSavedIDs: number[] | null = null;

/**
 * GET /settings が指定の除外 ID 一覧を返す状態をモックする。
 * @param ids 除外ポケモン ID の一覧。
 */
function mockGetSettings(ids: number[]) {
  server.use(
    http.get(apiUrl("/settings"), () =>
      HttpResponse.json({ excluded_pokemon_ids: ids }),
    ),
  );
}

/** PUT /settings/excluded-pokemon を成功させ、送られた pokemon_ids を lastSavedIDs に記録する。 */
function mockUpdateSuccess() {
  server.use(
    http.put(apiUrl("/settings/excluded-pokemon"), async ({ request }) => {
      const body = (await request.json()) as { pokemon_ids: number[] };
      lastSavedIDs = body.pokemon_ids;
      return HttpResponse.json({});
    }),
  );
}

/** PUT /settings/excluded-pokemon を 400 で失敗させる (不正な ID 相当)。 */
function mockUpdateFailure() {
  server.use(
    http.put(apiUrl("/settings/excluded-pokemon"), () =>
      HttpResponse.json({ error: "invalid id" }, { status: 400 }),
    ),
  );
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
describe("SettingsPage の遷移", () => {
  beforeEach(() => {
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
describe("SettingsPage の除外ポケモン管理", () => {
  beforeEach(() => {
    lastSavedIDs = null;
  });

  it("設定の読み込みに失敗するとエラーメッセージが表示される", async () => {
    // エラー経路の診断ログは検証対象外のため沈黙させる
    vi.spyOn(console, "error").mockImplementation(() => {});
    server.use(http.get(apiUrl("/settings"), () => HttpResponse.error()));
    renderSettings();

    expect(
      await screen.findByText(spec("設定の読み込みに失敗しました")),
    ).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it("ポケモン ID を追加すると保存され、一覧に表示される", async () => {
    mockGetSettings([]);
    mockUpdateSuccess();
    const user = userEvent.setup();
    renderSettings();

    await user.type(await screen.findByPlaceholderText("ポケモン ID"), "42");
    await user.click(screen.getByRole("button", { name: "追加" }));

    // 追加した ID が 3 桁 0 埋めで一覧に現れ、空状態の文言が消える
    expect(await screen.findByText("#042")).toBeInTheDocument();
    expect(
      screen.queryByText(spec("除外ポケモンはいません")),
    ).not.toBeInTheDocument();
    // 保存 API には追加後の ID 一覧が渡る (実際に送られた HTTP ボディで確認)
    await waitFor(() => expect(lastSavedIDs).toEqual([42]));
  });

  it("さくじょを押すと一覧から取り除かれ、空状態の文言に戻る", async () => {
    mockGetSettings([42]);
    mockUpdateSuccess();
    const user = userEvent.setup();
    renderSettings();

    expect(await screen.findByText("#042")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "削除" }));

    expect(
      await screen.findByText(spec("除外ポケモンはいません")),
    ).toBeInTheDocument();
    expect(screen.queryByText("#042")).not.toBeInTheDocument();
    // 保存 API には削除後の空一覧が渡る (実際に送られた HTTP ボディで確認)
    await waitFor(() => expect(lastSavedIDs).toEqual([]));
  });

  it("保存に失敗するとエラーメッセージが表示され、一覧は変わらない", async () => {
    // エラー経路の診断ログは検証対象外のため沈黙させる
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetSettings([]);
    mockUpdateFailure();
    const user = userEvent.setup();
    renderSettings();

    await user.type(await screen.findByPlaceholderText("ポケモン ID"), "42");
    await user.click(screen.getByRole("button", { name: "追加" }));

    expect(
      await screen.findByText(
        spec("設定の保存に失敗しました"),
      ),
    ).toBeInTheDocument();
    // 保存に失敗した ID は一覧に反映されず、空状態のまま
    expect(screen.queryByText("#042")).not.toBeInTheDocument();
    expect(
      screen.getByText(spec("除外ポケモンはいません")),
    ).toBeInTheDocument();
    vi.restoreAllMocks();
  });
});

/**
 * SettingsPage のサイト情報リンクの仕様:
 * - 問い合わせリンクは問い合わせフォームを新しいタブで開く
 * - 利用規約リンクは利用規約ページ (/terms) を指す
 */
describe("SettingsPage のサイト情報リンク", () => {
  beforeEach(() => {
    mockGetSettings([]);
  });

  it("問い合わせリンクが問い合わせフォームを新しいタブで開く", async () => {
    renderSettings();
    const link = await screen.findByRole("link", { name: "問い合わせ" });
    expect(link).toHaveAttribute("href", CONTACT_FORM_URL);
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("利用規約リンクが利用規約ページ (/terms) を指す", async () => {
    renderSettings();
    const link = await screen.findByRole("link", { name: "利用規約" });
    expect(link).toHaveAttribute("href", "/terms");
  });
});
