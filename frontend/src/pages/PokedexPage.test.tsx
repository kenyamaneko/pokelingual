import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { PokedexPage } from "./PokedexPage";
import { server, apiUrl } from "../test/mswServer";
import { spec } from "../test/labels";
import type {
  PokedexEntry,
  PokedexResponse,
  PokemonDetailResponse,
} from "../../../shared/api-types/pokedex";

/**
 * 図鑑一覧のダミーエントリを作る。
 * @param id テスト専用のダミーポケモン ID。
 * @param nameJa 画面で観測する日本語名。
 * @returns 図鑑一覧の 1 エントリ。
 */
function makeEntry(id: number, nameJa: string): PokedexEntry {
  return {
    pokemon_id: id,
    name_en: `Dummymon${id}`,
    name_ja: nameJa,
    sprite_url: `https://example.com/sprites/${id}.png`,
    status: "captured",
    total_captures: 1,
    best_score: 80,
  };
}

/**
 * GET /pokedex の成功レスポンスをモックする。
 * @param pokemon 一覧に返すエントリ。
 * @param capturedCount 捕獲済み数。
 * @param unavailableCount 読み込めなかった件数。
 */
function mockPokedex(
  pokemon: PokedexEntry[],
  capturedCount: number,
  unavailableCount: number,
) {
  const body: PokedexResponse = {
    pokemon,
    captured_count: capturedCount,
    unavailable_count: unavailableCount,
  };
  server.use(http.get(apiUrl("/pokedex"), () => HttpResponse.json(body)));
}

const dummyDetail: PokemonDetailResponse = {
  pokemon_id: 11,
  status: "captured",
  total_captures: 2,
  total_encounters: 3,
  last_captured_at: null,
  last_encountered_at: "2026-01-01T00:00:00Z",
  best_score: 90,
  name_en: "Dummymon11",
  name_ja: "ダミーモンA",
  description_en: "A dummy pokemon for testing.",
  description_ja: "テストのための　ダミーポケモン。",
  sprite_url: "https://example.com/sprites/11.png",
  types: ["grass"],
  height: 7,
  weight: 69,
};

/**
 * GET /pokedex/:id の成功レスポンスをモックする。
 * @param detail 返す詳細レスポンス。
 */
function mockDetail(detail: PokemonDetailResponse) {
  server.use(http.get(apiUrl("/pokedex/:id"), () => HttpResponse.json(detail)));
}

/**
 * PokedexPage の仕様:
 * - 一覧取得に成功すると全ポケモンのカードと捕獲済み数を表示する
 * - 読み込めなかったポケモンが 1 匹以上あるときだけ警告バナーを表示する
 * - 一覧が空なら空状態メッセージを表示する
 * - 一覧・詳細の取得に失敗したらエラーメッセージを表示する
 * - カードを選ぶと詳細モーダルを表示する
 *
 * API 境界 (HTTP) のみ MSW でモックし、グリッド・詳細カードは実部品で組み立てる。
 */
describe("PokedexPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("一覧取得に成功すると全ポケモンのカードと捕獲済み数が表示される", async () => {
    mockPokedex([makeEntry(11, "ダミーモンA"), makeEntry(22, "ダミーモンB")], 2, 0);

    render(<PokedexPage />);

    expect(await screen.findByText("ダミーモンA")).toBeInTheDocument();
    expect(screen.getByText("ダミーモンB")).toBeInTheDocument();
    expect(screen.getByText("2 匹")).toBeInTheDocument();
  });

  it("よみこめなかったポケモンが 0 匹のときは警告バナーが出ない", async () => {
    mockPokedex([makeEntry(11, "ダミーモンA")], 1, 0);

    render(<PokedexPage />);

    // 読み込み完了を待ってからバナーの不在を確かめる
    await screen.findByText("ダミーモンA");
    expect(screen.queryByText(/読み込めませんでした/)).not.toBeInTheDocument();
  });

  it("よみこめなかったポケモンが 1 匹のときは警告バナーが出る", async () => {
    mockPokedex([makeEntry(11, "ダミーモンA")], 1, 1);

    render(<PokedexPage />);

    expect(
      await screen.findByText(
        spec("1匹読み込めませんでした。あとでもう一度試してください"),
      ),
    ).toBeInTheDocument();
  });

  it("まだポケモンに出会っていない (0 件) ときは空状態メッセージが出る", async () => {
    mockPokedex([], 0, 0);

    render(<PokedexPage />);

    expect(
      await screen.findByText(spec("まだポケモンに出会っていません")),
    ).toBeInTheDocument();
  });

  it("一覧の取得に失敗するとエラーメッセージが表示される", async () => {
    // エラー経路の診断ログは検証対象外のため、テスト出力を汚さないよう沈黙させる
    vi.spyOn(console, "error").mockImplementation(() => {});
    server.use(http.get(apiUrl("/pokedex"), () => HttpResponse.error()));

    render(<PokedexPage />);

    expect(
      await screen.findByText(spec("図鑑の読み込みに失敗しました")),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("pokemon-card")).not.toBeInTheDocument();
  });

  it("カードを選ぶと詳細モーダルが表示される", async () => {
    mockPokedex([makeEntry(11, "ダミーモンA")], 1, 0);
    mockDetail(dummyDetail);
    const user = userEvent.setup();

    render(<PokedexPage />);

    await user.click(await screen.findByRole("button", { name: /ダミーモンA/ }));

    expect(
      await screen.findByText(spec("「テストのための　ダミーポケモン。」")),
    ).toBeInTheDocument();
    // タイプバッジまで描画される (詳細カードを実部品で組み立てた結果の観測)
    expect(screen.getByText("grass")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "閉じる" })).toBeInTheDocument();
  });

  it("詳細モーダルの とじる を押すと一覧へ戻る", async () => {
    mockPokedex([makeEntry(11, "ダミーモンA")], 1, 0);
    mockDetail(dummyDetail);
    const user = userEvent.setup();

    render(<PokedexPage />);

    await user.click(await screen.findByRole("button", { name: /ダミーモンA/ }));
    await user.click(await screen.findByRole("button", { name: "閉じる" }));

    // モーダルが閉じ、詳細説明が消えて一覧のカードだけが残る
    await waitFor(() =>
      expect(
        screen.queryByText(spec("「テストのための　ダミーポケモン。」")),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: /ダミーモンA/ })).toBeInTheDocument();
  });

  it("詳細の取得に失敗するとエラーメッセージが表示され、モーダルは開かない", async () => {
    // エラー経路の診断ログは検証対象外のため、テスト出力を汚さないよう沈黙させる
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockPokedex([makeEntry(11, "ダミーモンA")], 1, 0);
    server.use(http.get(apiUrl("/pokedex/:id"), () => HttpResponse.error()));
    const user = userEvent.setup();

    render(<PokedexPage />);

    await user.click(await screen.findByRole("button", { name: /ダミーモンA/ }));

    expect(
      await screen.findByText(spec("ポケモンの詳細の読み込みに失敗しました")),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "閉じる" })).not.toBeInTheDocument();
  });
});
