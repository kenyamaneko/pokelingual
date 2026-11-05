import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { useState } from "react";
import { MemoryRouter, Routes, Route } from "react-router";
import type { User } from "firebase/auth";
import { AuthContext } from "../contexts/AuthContext";
import { server, apiUrl } from "../test/mswServer";
import { LoginPage } from "./LoginPage";
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

/** PUT /settings/excluded-pokemon を 400 で失敗させる。 */
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
 * ログイン済みの AuthContext と /settings ルートで SettingsPage を描画する。ログアウト後の遷移先のログイン画面は実物を使う。
 * @param logout ログアウト操作のスタブ。成功すると AuthContext の user が未ログインになる。
 * @returns Testing Library の RenderResult。
 */
function renderSettings(logout: () => Promise<void> = async () => {}) {
  function Harness() {
    const [user, setUser] = useState<User | null>(fakeUser);
    const auth = {
      user,
      loading: false,
      login: async () => {},
      signup: async () => {},
      loginWithGoogle: async () => {},
      resetPassword: async () => {},
      logout: async () => {
        await logout();
        // ログアウトの成功で AuthContext の user が未ログインになる本番の動きに合わせるため、logout 成功後に user を外す
        setUser(null);
      },
    };
    return (
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={["/settings"]}>
          <Routes>
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );
  }
  return render(<Harness />);
}

describe("[本体:認証]ログアウト", () => {
  beforeEach(() => {
    mockGetSettings([]);
  });

  describe("部品間結合テスト", () => {
    describe("正常系", () => {
      it("設定画面で「ログアウト」を押すと、ログイン画面が表示される", async () => {
        const user = userEvent.setup();
        const logout = vi.fn().mockResolvedValue(undefined);
        renderSettings(logout);

        await user.click(await screen.findByRole("button", { name: "ログアウト" }));

        expect(await screen.findByRole("button", { name: "メールでログイン" })).toBeInTheDocument();
      });
    });
  });
});

describe("[本体:設定]設定の読み込み", () => {
  describe("部品間結合テスト", () => {
    describe("異常系", () => {
      it("設定の取得に失敗したとき、設定画面を開くと、「設定の読み込みに失敗しました」と表示される", async () => {
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
});

describe("[本体:設定]除外ポケモン設定", () => {
  beforeEach(() => {
    lastSavedIDs = null;
  });

  describe("ポケモンの名前の一覧に「ゴルバット」があるとき", () => {
    beforeEach(() => {
      mockSearchCandidates([{ pokemon_id: 42, name_ja: "ゴルバット" }]);
    });

    describe("部品間結合テスト", () => {
      describe("正常系", () => {
        it("設定画面で検索語「いない」を入力すると、検索結果に「ゴルバット」が表示されない", async () => {
          mockGetSettings([]);
          const user = userEvent.setup();
          renderSettings();

          await user.type(await screen.findByPlaceholderText("ポケモンの名前で探す"), "いない");

          expect(screen.queryByRole("button", { name: /ゴルバット/ })).not.toBeInTheDocument();
        });
      });
    });

    describe("除外ポケモンがいないとき", () => {
      beforeEach(() => {
        mockGetSettings([]);
        mockUpdateSuccess();
      });

      describe("設定画面で「ゴル」と入力して検索結果の「ゴルバット」(図鑑番号 42) を選ぶと", () => {
        async function searchAndSelectGolbat() {
          const user = userEvent.setup();
          renderSettings();

          await user.type(await screen.findByPlaceholderText("ポケモンの名前で探す"), "ゴル");
          await user.click(await screen.findByRole("button", { name: /ゴルバット/ }));
        }

        describe("部品間結合テスト", () => {
          describe("正常系", () => {
            it("除外ポケモンの一覧に「#042」と「ゴルバット」が表示される", async () => {
              await searchAndSelectGolbat();

              expect(await screen.findByText("#042")).toBeInTheDocument();
              expect(screen.getByText("ゴルバット")).toBeInTheDocument();
            });

            it("「除外ポケモンはいません」が表示されなくなる", async () => {
              await searchAndSelectGolbat();

              await screen.findByText("#042");
              expect(
                screen.queryByText(spec("除外ポケモンはいません")),
              ).not.toBeInTheDocument();
            });

            it("バックエンドに保存される除外ポケモンが、ゴルバット (図鑑番号 42) だけになる", async () => {
              await searchAndSelectGolbat();

              await waitFor(() => expect(lastSavedIDs).toEqual([42]));
            });
          });
        });
      });
    });

    describe("ゴルバット (図鑑番号 42) が除外済みのとき", () => {
      beforeEach(() => {
        mockGetSettings([42]);
        mockUpdateSuccess();
      });

      describe("設定画面で「削除」を押すと", () => {
        async function removeGolbat() {
          const user = userEvent.setup();
          renderSettings();

          await screen.findByText("#042");
          await user.click(screen.getByRole("button", { name: "削除" }));
        }

        describe("部品間結合テスト", () => {
          describe("正常系", () => {
            it("「除外ポケモンはいません」と表示される", async () => {
              await removeGolbat();

              expect(
                await screen.findByText(spec("除外ポケモンはいません")),
              ).toBeInTheDocument();
            });

            it("除外ポケモンの一覧に「#042」が表示されなくなる", async () => {
              await removeGolbat();

              await screen.findByText(spec("除外ポケモンはいません"));
              expect(screen.queryByText("#042")).not.toBeInTheDocument();
            });

            it("バックエンドに保存される除外ポケモンが、空になる", async () => {
              await removeGolbat();

              await waitFor(() => expect(lastSavedIDs).toEqual([]));
            });
          });
        });
      });

      describe("設定画面で「ゴル」と入力して検索結果の「ゴルバット」(図鑑番号 42) を選ぶと", () => {
        async function searchAndSelectExcludedGolbat() {
          const user = userEvent.setup();
          renderSettings();

          await screen.findByText("#042");
          await user.type(screen.getByPlaceholderText("ポケモンの名前で探す"), "ゴル");
          await user.click(await screen.findByRole("button", { name: /ゴルバット/ }));
        }

        describe("部品間結合テスト", () => {
          describe("異常系", () => {
            it("除外ポケモンの一覧の「#042」が 1 件のままになる", async () => {
              await searchAndSelectExcludedGolbat();

              await waitFor(() => expect(lastSavedIDs).not.toBeNull());
              expect(screen.getAllByText("#042")).toHaveLength(1);
            });

            it("バックエンドに保存される除外ポケモンが、ゴルバット (図鑑番号 42) だけのままになる", async () => {
              await searchAndSelectExcludedGolbat();

              await waitFor(() => expect(lastSavedIDs).toEqual([42]));
            });
          });
        });
      });
    });

    describe("除外ポケモンがおらず、除外ポケモンの保存に失敗するとき", () => {
      beforeEach(() => {
        // エラー経路の診断ログは検証対象外のため沈黙させる
        vi.spyOn(console, "error").mockImplementation(() => {});
        mockGetSettings([]);
        mockUpdateFailure();
      });

      describe("設定画面で「ゴル」と入力して検索結果の「ゴルバット」(図鑑番号 42) を選ぶと", () => {
        async function searchAndSelectGolbat() {
          const user = userEvent.setup();
          renderSettings();

          await user.type(await screen.findByPlaceholderText("ポケモンの名前で探す"), "ゴル");
          await user.click(await screen.findByRole("button", { name: /ゴルバット/ }));
        }

        describe("部品間結合テスト", () => {
          describe("異常系", () => {
            it("「設定の保存に失敗しました」と表示される", async () => {
              await searchAndSelectGolbat();

              expect(
                await screen.findByText(spec("設定の保存に失敗しました")),
              ).toBeInTheDocument();
              vi.restoreAllMocks();
            });

            it("除外ポケモンの一覧が空のまま「除外ポケモンはいません」と表示される", async () => {
              await searchAndSelectGolbat();

              await screen.findByText(spec("設定の保存に失敗しました"));
              expect(screen.queryByText("#042")).not.toBeInTheDocument();
              expect(
                screen.getByText(spec("除外ポケモンはいません")),
              ).toBeInTheDocument();
              vi.restoreAllMocks();
            });
          });
        });
      });
    });
  });

  describe("部品間結合テスト", () => {
    describe("正常系", () => {
      it("ポケモンの名前の一覧に「ニドリーナ」(図鑑番号 30) と「ニドクイン」(図鑑番号 31) があるとき、設定画面で検索語「ニド」を入力すると、検索結果に「ニドリーナ」と「ニドクイン」の両方が表示される", async () => {
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
    });
  });

  describe("ポケモンの名前の一覧の取得に失敗するとき", () => {
    beforeEach(() => {
      // エラー経路の診断ログは検証対象外のため沈黙させる
      vi.spyOn(console, "error").mockImplementation(() => {});
      mockGetSettings([]);
      server.use(http.get(apiUrl("/pokedex/search-candidates"), () => HttpResponse.error()));
    });

    describe("設定画面を開くと", () => {
      describe("部品間結合テスト", () => {
        describe("異常系", () => {
          it("「ポケモン一覧を読み込めませんでした。ページを再読み込みしてください」と表示される", async () => {
            renderSettings();

            expect(
              await screen.findByText(spec("ポケモン一覧を読み込めませんでした。ページを再読み込みしてください")),
            ).toBeInTheDocument();
            vi.restoreAllMocks();
          });

          it("「ポケモンの名前で探す」の検索欄が表示されない", async () => {
            renderSettings();

            await screen.findByText(spec("ポケモン一覧を読み込めませんでした。ページを再読み込みしてください"));
            expect(screen.queryByPlaceholderText("ポケモンの名前で探す")).not.toBeInTheDocument();
            vi.restoreAllMocks();
          });
        });
      });
    });
  });
});

describe("[本体:設定]出題する世代", () => {
  beforeEach(() => {
    lastSavedGenerations = null;
  });

  describe("設定済みの出題世代が第1世代と第3世代のとき", () => {
    beforeEach(() => {
      mockGetSettings([], [1, 3]);
    });

    describe("設定画面を開くと", () => {
      describe("部品間結合テスト", () => {
        describe("正常系", () => {
          it("「第1世代」にチェックが付く", async () => {
            renderSettings();

            expect(await screen.findByRole("checkbox", { name: /第1世代/ })).toBeChecked();
          });

          it("「第2世代」にチェックが付かない", async () => {
            renderSettings();

            expect(await screen.findByRole("checkbox", { name: /第2世代/ })).not.toBeChecked();
          });

          it("「第3世代」にチェックが付く", async () => {
            renderSettings();

            expect(await screen.findByRole("checkbox", { name: /第3世代/ })).toBeChecked();
          });
        });
      });
    });
  });

  describe("第1世代から第3世代までが選ばれているとき", () => {
    beforeEach(() => {
      mockGetSettings([], [1, 2, 3]);
      mockUpdateGenerationsSuccess();
    });

    describe("「第2世代」のチェックを外すと", () => {
      async function uncheckSecondGeneration() {
        const user = userEvent.setup();
        renderSettings();

        await user.click(await screen.findByRole("checkbox", { name: /第2世代/ }));
      }

      describe("部品間結合テスト", () => {
        describe("正常系", () => {
          it("バックエンドに保存される出題世代が、第1世代と第3世代になる", async () => {
            await uncheckSecondGeneration();

            await waitFor(() => expect(lastSavedGenerations).toEqual([1, 3]));
          });

          it("「第2世代」のチェックが外れる", async () => {
            await uncheckSecondGeneration();

            await waitFor(() => expect(lastSavedGenerations).toEqual([1, 3]));
            expect(screen.getByRole("checkbox", { name: /第2世代/ })).not.toBeChecked();
          });
        });
      });
    });
  });

  describe("第1世代だけが選ばれているとき", () => {
    beforeEach(() => {
      mockGetSettings([], [1]);
      mockUpdateGenerationsSuccess();
    });

    describe("「第4世代」のチェックを付けると", () => {
      async function checkFourthGeneration() {
        const user = userEvent.setup();
        renderSettings();

        await user.click(await screen.findByRole("checkbox", { name: /第4世代/ }));
      }

      describe("部品間結合テスト", () => {
        describe("正常系", () => {
          it("バックエンドに保存される出題世代が、第1世代と第4世代になる", async () => {
            await checkFourthGeneration();

            await waitFor(() => expect(lastSavedGenerations).toEqual([1, 4]));
          });

          it("「第4世代」のチェックが付く", async () => {
            await checkFourthGeneration();

            await waitFor(() => expect(lastSavedGenerations).toEqual([1, 4]));
            expect(screen.getByRole("checkbox", { name: /第4世代/ })).toBeChecked();
          });
        });
      });
    });
  });

  describe("第5世代だけが選ばれているとき", () => {
    beforeEach(() => {
      mockGetSettings([], [5]);
      mockUpdateGenerationsSuccess();
    });

    describe("設定画面を開くと", () => {
      describe("部品間結合テスト", () => {
        describe("異常系", () => {
          it("「第5世代」のチェックボックスが押せない状態になる", async () => {
            renderSettings();

            expect(await screen.findByRole("checkbox", { name: /第5世代/ })).toBeDisabled();
          });

          it("「1つ以上えらんでね（ぜんぶは外せないよ）」と表示される", async () => {
            renderSettings();

            await screen.findByRole("checkbox", { name: /第5世代/ });
            expect(
              screen.getByText(spec("1つ以上えらんでね（ぜんぶは外せないよ）")),
            ).toBeInTheDocument();
          });
        });
      });
    });

    describe("「第5世代」のチェックを押すと", () => {
      async function pressOnlyGeneration() {
        const user = userEvent.setup();
        renderSettings();

        const only = await screen.findByRole("checkbox", { name: /第5世代/ });
        await user.click(only);
        return only;
      }

      describe("部品間結合テスト", () => {
        describe("異常系", () => {
          it("チェックが付いたままになる", async () => {
            const only = await pressOnlyGeneration();

            expect(only).toBeChecked();
          });

          it("バックエンドに出題世代が保存されない", async () => {
            await pressOnlyGeneration();

            expect(lastSavedGenerations).toBeNull();
          });
        });
      });
    });
  });
});

describe("[本体:サイト情報]設定画面の問い合わせ", () => {
  beforeEach(() => {
    mockGetSettings([]);
  });

  describe("設定画面を開くと", () => {
    describe("部品間結合テスト", () => {
      describe("正常系", () => {
        it("「問い合わせ」のリンク先は「https://forms.gle/mUhMjSMf8TPJc3CC9」で、新しいタブで開く", async () => {
          renderSettings();

          const link = await screen.findByRole("link", { name: "問い合わせ" });
          expect(link).toHaveAttribute("href", "https://forms.gle/mUhMjSMf8TPJc3CC9");
          expect(link).toHaveAttribute("target", "_blank");
        });
      });
    });
  });
});

describe("[本体:サイト情報]設定画面の GitHub リポジトリ", () => {
  beforeEach(() => {
    mockGetSettings([]);
  });

  describe("設定画面を開くと", () => {
    describe("部品間結合テスト", () => {
      describe("正常系", () => {
        it("「GitHub リポジトリ」のリンク先は「https://github.com/kenyamaneko/pokelingual」で、新しいタブで開く", async () => {
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
    });
  });
});

describe("[本体:サイト情報]設定画面の利用規約", () => {
  beforeEach(() => {
    mockGetSettings([]);
  });

  describe("部品間結合テスト", () => {
    describe("正常系", () => {
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
});
