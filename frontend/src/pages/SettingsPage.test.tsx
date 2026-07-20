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
import { CONTACT_FORM_URL, GITHUB_REPO_URL } from "../constants/links";

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
 * GET /pokedex が指定のエントリを返す状態をモックする (名前検索・名前併記の元データ)。
 * @param entries pokemon_id と name_en / name_ja を持つエントリ。
 */
function mockPokedexEntries(
  entries: { pokemon_id: number; name_en: string; name_ja: string }[],
) {
  server.use(
    http.get(apiUrl("/pokedex"), () =>
      HttpResponse.json({
        pokemon: entries.map((e) => ({
          pokemon_id: e.pokemon_id,
          name_en: e.name_en,
          name_ja: e.name_ja,
          sprite_url: "",
          status: "unknown",
          total_captures: 0,
          best_score: 0,
        })),
        captured_count: 0,
        unavailable_count: 0,
      }),
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
describe("[設定] 設定画面の遷移", () => {
  beforeEach(() => {
    mockGetSettings([]);
  });

  it("ログアウトを押すと、ログイン画面へ遷移する", async () => {
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
 * SettingsPage の苦手ポケモン管理仕様 (名前検索):
 * - 設定の読み込みに失敗したらエラーメッセージを表示する
 * - 名前で検索して候補を選ぶと、その ID が保存され一覧に名前付きで表示される
 * - 検索語に一致するポケモンがなければ候補が出ない
 * - すでに除外済みのポケモンは候補に出ない
 * - さくじょを押すと一覧から取り除かれ、空状態の文言に戻る
 * - 保存に失敗したらエラーメッセージを表示し、一覧は変わらない
 * - 図鑑一覧の取得に失敗したら名前で探せない旨を表示する
 *
 * ID の範囲・件数上限・重複のバリデーションは backend の責務のため、ここでは検証しない。
 */
describe("[設定] 設定画面の苦手ポケモン管理", () => {
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

  it("名前で検索して候補を選ぶと、その ID が保存され一覧に名前付きで表示される", async () => {
    mockGetSettings([]);
    mockPokedexEntries([{ pokemon_id: 42, name_en: "Golbat", name_ja: "ゴルバット" }]);
    mockUpdateSuccess();
    const user = userEvent.setup();
    renderSettings();

    await user.type(await screen.findByPlaceholderText("ポケモンの名前で探す"), "ゴル");
    await user.click(await screen.findByRole("button", { name: /ゴルバット/ }));

    // 一覧に #042 と名前が現れ、空状態の文言が消え、保存 API に [42] が渡る
    expect(await screen.findByText("#042")).toBeInTheDocument();
    expect(screen.getByText("ゴルバット")).toBeInTheDocument();
    expect(
      screen.queryByText(spec("除外ポケモンはいません")),
    ).not.toBeInTheDocument();
    await waitFor(() => expect(lastSavedIDs).toEqual([42]));
  });

  it("検索語に一致するポケモンがなければ候補が出ない", async () => {
    mockGetSettings([]);
    mockPokedexEntries([{ pokemon_id: 42, name_en: "Golbat", name_ja: "ゴルバット" }]);
    const user = userEvent.setup();
    renderSettings();

    await user.type(await screen.findByPlaceholderText("ポケモンの名前で探す"), "いない");
    expect(screen.queryByRole("button", { name: /ゴルバット/ })).not.toBeInTheDocument();
  });

  it("複数のポケモンが名前にヒットすると、その全てが候補に出る", async () => {
    mockGetSettings([]);
    mockPokedexEntries([
      { pokemon_id: 30, name_en: "Nidorina", name_ja: "ニドリーナ" },
      { pokemon_id: 31, name_en: "Nidoqueen", name_ja: "ニドクイン" },
    ]);
    const user = userEvent.setup();
    renderSettings();

    await user.type(await screen.findByPlaceholderText("ポケモンの名前で探す"), "ニド");

    // 「ニド」に一致する2匹が候補ボタンとして出る
    expect(await screen.findByRole("button", { name: /ニドリーナ/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ニドクイン/ })).toBeInTheDocument();
  });

  it("すでに除外済みのポケモンは検索候補に出ない", async () => {
    mockGetSettings([42]);
    mockPokedexEntries([{ pokemon_id: 42, name_en: "Golbat", name_ja: "ゴルバット" }]);
    const user = userEvent.setup();
    renderSettings();

    // 読み込み完了 (登録済みが一覧に出る) を待つ
    await screen.findByText("#042");
    await user.type(screen.getByPlaceholderText("ポケモンの名前で探す"), "ゴル");
    // 候補ボタン (名前を含む button) は出ない
    expect(screen.queryByRole("button", { name: /ゴルバット/ })).not.toBeInTheDocument();
  });

  it("削除を押すと一覧から取り除かれ、空状態の文言に戻る", async () => {
    mockGetSettings([42]);
    mockPokedexEntries([{ pokemon_id: 42, name_en: "Golbat", name_ja: "ゴルバット" }]);
    mockUpdateSuccess();
    const user = userEvent.setup();
    renderSettings();

    // 一覧には #042 と名前が併記される
    expect(await screen.findByText("#042")).toBeInTheDocument();
    expect(screen.getByText("ゴルバット")).toBeInTheDocument();
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
    mockPokedexEntries([{ pokemon_id: 42, name_en: "Golbat", name_ja: "ゴルバット" }]);
    mockUpdateFailure();
    const user = userEvent.setup();
    renderSettings();

    await user.type(await screen.findByPlaceholderText("ポケモンの名前で探す"), "ゴル");
    await user.click(await screen.findByRole("button", { name: /ゴルバット/ }));

    expect(
      await screen.findByText(spec("設定の保存に失敗しました")),
    ).toBeInTheDocument();
    // 保存に失敗した ID は一覧に反映されず、空状態のまま
    expect(screen.queryByText("#042")).not.toBeInTheDocument();
    expect(
      screen.getByText(spec("除外ポケモンはいません")),
    ).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it("図鑑一覧の取得に失敗すると、再読み込みを促すメッセージを表示する", async () => {
    // エラー経路の診断ログは検証対象外のため沈黙させる
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetSettings([]);
    server.use(http.get(apiUrl("/pokedex"), () => HttpResponse.error()));
    renderSettings();

    expect(
      await screen.findByText(spec("ポケモン一覧を読み込めませんでした。ページを再読み込みしてください")),
    ).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("ポケモンの名前で探す")).not.toBeInTheDocument();
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
describe("[設定] 設定画面の出題世代", () => {
  beforeEach(() => {
    lastSavedGenerations = null;
  });

  it("選択済みの世代がチェック状態で復元される", async () => {
    mockGetSettings([], [1, 3]);
    renderSettings();

    expect(await screen.findByRole("checkbox", { name: /第1世代/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /第2世代/ })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /第3世代/ })).toBeChecked();
  });

  it("世代のチェックを外すと、その世代を除いた一覧が保存される", async () => {
    mockGetSettings([], [1, 2, 3]);
    mockUpdateGenerationsSuccess();
    const user = userEvent.setup();
    renderSettings();

    await user.click(await screen.findByRole("checkbox", { name: /第2世代/ }));

    // 第2世代を外した [1, 3] が保存され、チェックも外れる
    await waitFor(() => expect(lastSavedGenerations).toEqual([1, 3]));
    expect(screen.getByRole("checkbox", { name: /第2世代/ })).not.toBeChecked();
  });

  it("世代のチェックを付けると、その世代を加えた一覧が保存される", async () => {
    mockGetSettings([], [1]);
    mockUpdateGenerationsSuccess();
    const user = userEvent.setup();
    renderSettings();

    await user.click(await screen.findByRole("checkbox", { name: /第4世代/ }));

    // 第4世代を加えた [1, 4] が保存され、チェックが付く
    await waitFor(() => expect(lastSavedGenerations).toEqual([1, 4]));
    expect(screen.getByRole("checkbox", { name: /第4世代/ })).toBeChecked();
  });

  it("選択が1つだけのときはその世代を外せず、1つ以上必要な旨を表示する", async () => {
    mockGetSettings([], [5]);
    mockUpdateGenerationsSuccess();
    const user = userEvent.setup();
    renderSettings();

    const only = await screen.findByRole("checkbox", { name: /第5世代/ });
    expect(only).toBeChecked();
    expect(only).toBeDisabled();
    // なぜ外せないかが分かる案内を出す
    expect(
      screen.getByText(spec("1つ以上えらんでね（ぜんぶは外せないよ）")),
    ).toBeInTheDocument();

    await user.click(only);

    expect(only).toBeChecked();
    expect(lastSavedGenerations).toBeNull();
  });
});

/**
 * SettingsPage のサイト情報リンクの仕様:
 * - 問い合わせリンクは問い合わせフォームを新しいタブで開く
 * - 利用規約リンクは利用規約ページ (/terms) を指す
 */
describe("[サイト情報] 設定画面のサイト情報リンク", () => {
  beforeEach(() => {
    mockGetSettings([]);
  });

  it("問い合わせリンクが問い合わせフォームを新しいタブで開く", async () => {
    renderSettings();
    const link = await screen.findByRole("link", { name: "問い合わせ" });
    expect(link).toHaveAttribute("href", CONTACT_FORM_URL);
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("利用規約リンクが利用規約ページを指す", async () => {
    renderSettings();
    const link = await screen.findByRole("link", { name: "利用規約" });
    expect(link).toHaveAttribute("href", "/terms");
  });

  it("GitHub リポジトリリンクがリポジトリページを新しいタブで開く", async () => {
    renderSettings();
    const link = await screen.findByRole("link", { name: "GitHub リポジトリ" });
    expect(link).toHaveAttribute("href", GITHUB_REPO_URL);
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("GitHub リポジトリリンクに、自分の環境にホスティングできる旨の説明が添えられる", async () => {
    renderSettings();
    await screen.findByRole("link", { name: "GitHub リポジトリ" });
    expect(
      screen.getByText("回数を気にせず遊びたい方は、このソースコードで自分の環境にホスティングすることもできます"),
    ).toBeInTheDocument();
  });
});
