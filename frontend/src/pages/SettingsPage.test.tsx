import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Routes, Route } from "react-router";
import type { User } from "firebase/auth";
import { AuthContext } from "../contexts/AuthContext";
import { server, apiUrl } from "../test/mswServer";
import { SettingsPage } from "./SettingsPage";
import { spec } from "../test/labels";

const fakeUser = { uid: "alice", email: "alice@example.com" } as unknown as User;

let lastSavedIDs: number[] | null = null;
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
 * GET /pokedex/search-candidates が指定の候補を返す状態をモックする (名前検索・名前併記の元データ)。
 * @param candidates pokemon_id と name_ja を持つ検索候補。
 */
function mockSearchCandidates(
  candidates: { pokemon_id: number; name_ja: string }[],
) {
  server.use(
    http.get(apiUrl("/pokedex/search-candidates"), () =>
      HttpResponse.json({ pokemon: candidates }),
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

describe("[設定] ログアウト", () => {
  beforeEach(() => {
    mockGetSettings([]);
  });

  describe("正常系", () => {
    it("「ログアウト」を押すと、ログイン画面に遷移する", async () => {
      const user = userEvent.setup();
      const logout = vi.fn().mockResolvedValue(undefined);
      renderSettings(logout);

      // 設定の読み込みが終わってから操作できるため、ログアウトボタンが表示されるのを待つ
      const logoutButton = await screen.findByRole("button", { name: "ログアウト" });
      await user.click(logoutButton);

      await waitFor(() => {
        expect(screen.getByTestId("login-page")).toBeInTheDocument();
      });
    });
  });
});

describe("[設定] 設定の読み込み", () => {
  describe("異常系", () => {
    it("設定の取得に失敗したとき、「設定の読み込みに失敗しました」と表示される", async () => {
      // エラー経路の診断ログは検証対象外のため沈黙させる
      vi.spyOn(console, "error").mockImplementation(() => {});
      server.use(http.get(apiUrl("/settings"), () => HttpResponse.error()));
      renderSettings();

      expect(
        await screen.findByText(spec("設定の読み込みに失敗しました")),
      ).toBeInTheDocument();
      vi.restoreAllMocks();
    });
  });
});

describe("[設定] 苦手ポケモン設定", () => {
  beforeEach(() => {
    lastSavedIDs = null;
  });

  describe("正常系", () => {
    describe("除外ポケモンがいない状態で、「ゴル」と入力して検索結果の「ゴルバット」を選んだとき", () => {
      async function searchAndSelectGolbat() {
        mockGetSettings([]);
        mockSearchCandidates([{ pokemon_id: 42, name_ja: "ゴルバット" }]);
        mockUpdateSuccess();
        const user = userEvent.setup();
        renderSettings();

        await user.type(await screen.findByPlaceholderText("ポケモンの名前で探す"), "ゴル");
        await user.click(await screen.findByRole("button", { name: /ゴルバット/ }));
      }

      it("除外ポケモンの一覧に「#042」と「ゴルバット」が表示される", async () => {
        await searchAndSelectGolbat();

        expect(await screen.findByText("#042")).toBeInTheDocument();
        expect(screen.getByText("ゴルバット")).toBeInTheDocument();
        expect(
          screen.queryByText(spec("除外ポケモンはいません")),
        ).not.toBeInTheDocument();
      });

      it("保存される除外ポケモンの一覧が、ゴルバット (図鑑番号 42) だけになる", async () => {
        await searchAndSelectGolbat();

        await waitFor(() => expect(lastSavedIDs).toEqual([42]));
      });
    });

    it("検索語「いない」がどのポケモンの名前にも一致しないとき、検索結果に「ゴルバット」が表示されない", async () => {
      mockGetSettings([]);
      mockSearchCandidates([{ pokemon_id: 42, name_ja: "ゴルバット" }]);
      const user = userEvent.setup();
      renderSettings();

      await user.type(await screen.findByPlaceholderText("ポケモンの名前で探す"), "いない");
      expect(screen.queryByRole("button", { name: /ゴルバット/ })).not.toBeInTheDocument();
    });

    it("検索語「ニド」が「ニドリーナ」と「ニドクイン」の名前に一致するとき、検索結果に両方が表示される", async () => {
      mockGetSettings([]);
      mockSearchCandidates([
        { pokemon_id: 30, name_ja: "ニドリーナ" },
        { pokemon_id: 31, name_ja: "ニドクイン" },
      ]);
      const user = userEvent.setup();
      renderSettings();

      await user.type(await screen.findByPlaceholderText("ポケモンの名前で探す"), "ニド");

      expect(await screen.findByRole("button", { name: /ニドリーナ/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /ニドクイン/ })).toBeInTheDocument();
    });

    describe("ゴルバット (図鑑番号 42) を除外済みの状態で、「削除」を押したとき", () => {
      async function removeGolbat() {
        mockGetSettings([42]);
        mockSearchCandidates([{ pokemon_id: 42, name_ja: "ゴルバット" }]);
        mockUpdateSuccess();
        const user = userEvent.setup();
        renderSettings();

        await screen.findByText("#042");
        await user.click(screen.getByRole("button", { name: "削除" }));
      }

      it("「除外ポケモンはいません」と表示される", async () => {
        await removeGolbat();

        expect(
          await screen.findByText(spec("除外ポケモンはいません")),
        ).toBeInTheDocument();
        expect(screen.queryByText("#042")).not.toBeInTheDocument();
      });

      it("保存される除外ポケモンの一覧が空になる", async () => {
        await removeGolbat();

        await waitFor(() => expect(lastSavedIDs).toEqual([]));
      });
    });
  });

  describe("異常系", () => {
    describe("ゴルバット (図鑑番号 42) を除外済みの状態で、「ゴル」と入力して検索結果の「ゴルバット」を選んだとき", () => {
      async function searchAndSelectExcludedGolbat() {
        mockGetSettings([42]);
        mockSearchCandidates([{ pokemon_id: 42, name_ja: "ゴルバット" }]);
        mockUpdateSuccess();
        const user = userEvent.setup();
        renderSettings();

        await screen.findByText("#042");
        await user.type(screen.getByPlaceholderText("ポケモンの名前で探す"), "ゴル");
        await user.click(await screen.findByRole("button", { name: /ゴルバット/ }));
      }

      it("除外ポケモンの一覧の「#042」が 1 件のままになる", async () => {
        await searchAndSelectExcludedGolbat();

        await waitFor(() => expect(lastSavedIDs).not.toBeNull());
        expect(screen.getAllByText("#042")).toHaveLength(1);
      });

      it("保存される除外ポケモンの一覧が、ゴルバット (図鑑番号 42) だけのままになる", async () => {
        await searchAndSelectExcludedGolbat();

        await waitFor(() => expect(lastSavedIDs).toEqual([42]));
      });
    });

    describe("設定の保存に失敗する状態で、「ゴル」と入力して検索結果の「ゴルバット」を選んだとき", () => {
      async function searchAndSelectGolbatWhenSaveFails() {
        // エラー経路の診断ログは検証対象外のため沈黙させる
        vi.spyOn(console, "error").mockImplementation(() => {});
        mockGetSettings([]);
        mockSearchCandidates([{ pokemon_id: 42, name_ja: "ゴルバット" }]);
        mockUpdateFailure();
        const user = userEvent.setup();
        renderSettings();

        await user.type(await screen.findByPlaceholderText("ポケモンの名前で探す"), "ゴル");
        await user.click(await screen.findByRole("button", { name: /ゴルバット/ }));
      }

      it("「設定の保存に失敗しました」と表示される", async () => {
        await searchAndSelectGolbatWhenSaveFails();

        expect(
          await screen.findByText(spec("設定の保存に失敗しました")),
        ).toBeInTheDocument();
        vi.restoreAllMocks();
      });

      it("除外ポケモンの一覧が空のまま「除外ポケモンはいません」と表示される", async () => {
        await searchAndSelectGolbatWhenSaveFails();

        await screen.findByText(spec("設定の保存に失敗しました"));
        expect(screen.queryByText("#042")).not.toBeInTheDocument();
        expect(
          screen.getByText(spec("除外ポケモンはいません")),
        ).toBeInTheDocument();
        vi.restoreAllMocks();
      });
    });

    describe("ポケモン一覧の取得に失敗したとき", () => {
      function renderWhenSearchCatalogFails() {
        // エラー経路の診断ログは検証対象外のため沈黙させる
        vi.spyOn(console, "error").mockImplementation(() => {});
        mockGetSettings([]);
        server.use(http.get(apiUrl("/pokedex/search-candidates"), () => HttpResponse.error()));
        renderSettings();
      }

      it("「ポケモン一覧を読み込めませんでした。ページを再読み込みしてください」と表示される", async () => {
        renderWhenSearchCatalogFails();

        expect(
          await screen.findByText(spec("ポケモン一覧を読み込めませんでした。ページを再読み込みしてください")),
        ).toBeInTheDocument();
        vi.restoreAllMocks();
      });

      it("「ポケモンの名前で探す」の検索欄が表示されない", async () => {
        renderWhenSearchCatalogFails();

        await screen.findByText(spec("ポケモン一覧を読み込めませんでした。ページを再読み込みしてください"));
        expect(screen.queryByPlaceholderText("ポケモンの名前で探す")).not.toBeInTheDocument();
        vi.restoreAllMocks();
      });
    });
  });
});

describe("[設定] 出題する世代", () => {
  beforeEach(() => {
    lastSavedGenerations = null;
  });

  describe("正常系", () => {
    describe("設定済みの世代が第 1 世代と第 3 世代のとき、設定画面を開くと", () => {
      it("第 1 世代にチェックが付く", async () => {
        mockGetSettings([], [1, 3]);
        renderSettings();

        expect(await screen.findByRole("checkbox", { name: /第1世代/ })).toBeChecked();
      });

      it("第 2 世代にはチェックが付かない", async () => {
        mockGetSettings([], [1, 3]);
        renderSettings();

        expect(await screen.findByRole("checkbox", { name: /第2世代/ })).not.toBeChecked();
      });

      it("第 3 世代にチェックが付く", async () => {
        mockGetSettings([], [1, 3]);
        renderSettings();

        expect(await screen.findByRole("checkbox", { name: /第3世代/ })).toBeChecked();
      });
    });

    describe("第 1 世代から第 3 世代までが選ばれている状態で、第 2 世代のチェックを外したとき", () => {
      async function uncheckSecondGeneration() {
        mockGetSettings([], [1, 2, 3]);
        mockUpdateGenerationsSuccess();
        const user = userEvent.setup();
        renderSettings();

        await user.click(await screen.findByRole("checkbox", { name: /第2世代/ }));
      }

      it("保存される出題世代が、第 1 世代と第 3 世代になる", async () => {
        await uncheckSecondGeneration();

        await waitFor(() => expect(lastSavedGenerations).toEqual([1, 3]));
      });

      it("第 2 世代のチェックが外れる", async () => {
        await uncheckSecondGeneration();

        await waitFor(() => expect(lastSavedGenerations).toEqual([1, 3]));
        expect(screen.getByRole("checkbox", { name: /第2世代/ })).not.toBeChecked();
      });
    });

    describe("第 1 世代だけが選ばれている状態で、第 4 世代のチェックを付けたとき", () => {
      async function checkFourthGeneration() {
        mockGetSettings([], [1]);
        mockUpdateGenerationsSuccess();
        const user = userEvent.setup();
        renderSettings();

        await user.click(await screen.findByRole("checkbox", { name: /第4世代/ }));
      }

      it("保存される出題世代が、第 1 世代と第 4 世代になる", async () => {
        await checkFourthGeneration();

        await waitFor(() => expect(lastSavedGenerations).toEqual([1, 4]));
      });

      it("第 4 世代のチェックが付く", async () => {
        await checkFourthGeneration();

        await waitFor(() => expect(lastSavedGenerations).toEqual([1, 4]));
        expect(screen.getByRole("checkbox", { name: /第4世代/ })).toBeChecked();
      });
    });
  });

  describe("異常系", () => {
    describe("第 5 世代だけが選ばれている状態のとき", () => {
      it("第 5 世代のチェックを押しても、チェックが外れない", async () => {
        mockGetSettings([], [5]);
        mockUpdateGenerationsSuccess();
        const user = userEvent.setup();
        renderSettings();

        const only = await screen.findByRole("checkbox", { name: /第5世代/ });
        expect(only).toBeChecked();
        expect(only).toBeDisabled();

        await user.click(only);

        expect(only).toBeChecked();
        expect(lastSavedGenerations).toBeNull();
      });

      it("「1つ以上えらんでね（ぜんぶは外せないよ）」と表示される", async () => {
        mockGetSettings([], [5]);
        renderSettings();

        await screen.findByRole("checkbox", { name: /第5世代/ });
        expect(
          screen.getByText(spec("1つ以上えらんでね（ぜんぶは外せないよ）")),
        ).toBeInTheDocument();
      });
    });
  });
});

describe("[サイト情報] 設定画面の問い合わせ・利用規約・GitHub リポジトリ", () => {
  beforeEach(() => {
    mockGetSettings([]);
  });

  describe("正常系", () => {
    describe("設定画面を表示したとき", () => {
      it("「問い合わせ」のリンクは、問い合わせフォームを新しいタブで開くリンクになっている", async () => {
        renderSettings();
        const link = await screen.findByRole("link", { name: "問い合わせ" });
        expect(link).toHaveAttribute("href", "https://forms.gle/mUhMjSMf8TPJc3CC9");
        expect(link).toHaveAttribute("target", "_blank");
      });

      it("「GitHub リポジトリ」のリンクは、リポジトリのページを新しいタブで開くリンクになっている", async () => {
        renderSettings();
        const link = await screen.findByRole("link", { name: "GitHub リポジトリ" });
        expect(link).toHaveAttribute("href", "https://github.com/kenyamaneko/pokelingual");
        expect(link).toHaveAttribute("target", "_blank");
      });

      it("「回数を気にせず遊びたい方は、このソースコードで自分の環境にホスティングすることもできます」と表示される", async () => {
        renderSettings();
        await screen.findByRole("link", { name: "GitHub リポジトリ" });
        expect(
          screen.getByText("回数を気にせず遊びたい方は、このソースコードで自分の環境にホスティングすることもできます"),
        ).toBeInTheDocument();
      });
    });

    it("設定画面で「利用規約」を押すと、利用規約モーダルが表示される", async () => {
      const user = userEvent.setup();
      renderSettings();

      await user.click(await screen.findByRole("button", { name: "利用規約" }));

      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("利用規約モーダルが開いているとき、「閉じる」を押すと、モーダルが閉じて設定画面が表示される", async () => {
      const user = userEvent.setup();
      renderSettings();
      await user.click(await screen.findByRole("button", { name: "利用規約" }));

      await user.click(screen.getByRole("button", { name: "閉じる" }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "設定" })).toBeInTheDocument();
    });
  });
});
