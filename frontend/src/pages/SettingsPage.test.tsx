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

const fakeUser = { uid: "alice", email: "alice@example.com" } as unknown as User;

// PUT /settings/excluded-pokemon で実際に送られたボディ (保存内容) を HTTP 境界で捕捉する。
let lastSavedIDs: number[] | null = null;
// PUT /settings/generations で実際に送られた世代一覧を HTTP 境界で捕捉する。
let lastSavedGenerations: number[] | null = null;

/**
 * GET /settings が指定の除外 ID・出題世代を返す状態をモックする。
 * @param ids 除外ポケモン ID の一覧。
 * @param generations 出題対象の世代 (既定は全世代)。
 */
function mockGetSettings(ids: number[], generations: number[] = [1, 2, 3, 4, 5, 6, 7, 8]) {
  server.use(
    http.get(apiUrl("/settings"), () =>
      HttpResponse.json({ excluded_pokemon_ids: ids, enabled_generations: generations }),
    ),
  );
}

/** PUT /settings/generations を成功させ、送られた generations を lastSavedGenerations に記録する。 */
function mockUpdateGenerationsSuccess() {
  server.use(
    http.put(apiUrl("/settings/generations"), async ({ request }) => {
      const body = (await request.json()) as { generations: number[] };
      lastSavedGenerations = body.generations;
      return HttpResponse.json({});
    }),
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
 * SettingsPage の出題世代の設定仕様:
 * - GET の enabled_generations でチェック状態が復元される
 * - チェックを付け外しすると、その世代を加減した一覧が保存される
 * - 最低1世代必須のため、選択が1つだけのときはその世代を外せない
 *
 * 世代番号・未知値のバリデーションは backend の責務のため、ここでは検証しない。
 */
describe("SettingsPage の出題世代", () => {
  beforeEach(() => {
    lastSavedGenerations = null;
  });

  it("GET の enabled_generations に応じてチェック状態が復元される", async () => {
    mockGetSettings([], [1, 3]);
    renderSettings();

    expect(await screen.findByRole("checkbox", { name: "第1世代" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "第2世代" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "第3世代" })).toBeChecked();
  });

  it("世代のチェックを外すと、その世代を除いた一覧が保存される", async () => {
    mockGetSettings([], [1, 2, 3]);
    mockUpdateGenerationsSuccess();
    const user = userEvent.setup();
    renderSettings();

    await user.click(await screen.findByRole("checkbox", { name: "第2世代" }));

    // 第2世代を外した [1, 3] が保存され、チェックも外れる
    await waitFor(() => expect(lastSavedGenerations).toEqual([1, 3]));
    expect(screen.getByRole("checkbox", { name: "第2世代" })).not.toBeChecked();
  });

  it("世代のチェックを付けると、その世代を加えた一覧が保存される", async () => {
    mockGetSettings([], [1]);
    mockUpdateGenerationsSuccess();
    const user = userEvent.setup();
    renderSettings();

    await user.click(await screen.findByRole("checkbox", { name: "第4世代" }));

    // 第4世代を加えた [1, 4] が保存され、チェックが付く
    await waitFor(() => expect(lastSavedGenerations).toEqual([1, 4]));
    expect(screen.getByRole("checkbox", { name: "第4世代" })).toBeChecked();
  });

  it("最後の1世代は外せない (最低1世代必須で保存も走らない)", async () => {
    mockGetSettings([], [5]);
    mockUpdateGenerationsSuccess();
    const user = userEvent.setup();
    renderSettings();

    const only = await screen.findByRole("checkbox", { name: "第5世代" });
    expect(only).toBeChecked();
    expect(only).toBeDisabled();

    await user.click(only);

    expect(only).toBeChecked();
    expect(lastSavedGenerations).toBeNull();
  });
});
