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
 * 図鑑一覧のエントリを作る。
 * @param id 図鑑番号。
 * @param nameEn 画面で観測する英語名。
 * @param nameJa 画面で観測する日本語名。
 * @returns 図鑑一覧の 1 エントリ。
 */
function makeEntry(id: number, nameEn: string, nameJa: string): PokedexEntry {
  return {
    pokemon_id: id,
    name_en: nameEn,
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
  pokemon_id: 1,
  status: "captured",
  total_captures: 2,
  total_encounters: 3,
  last_captured_at: null,
  last_encountered_at: "2026-01-01T00:00:00Z",
  best_score: 90,
  name_en: "Bulbasaur",
  name_ja: "フシギダネ",
  description_en:
    "A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokémon.",
  description_ja: "生まれたときから　背中に 不思議な　タネが　植えてあって 体と　ともに　育つという。",
  sprite_url: "https://example.com/sprites/1.png",
  types: ["grass", "poison"],
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe("[図鑑] 図鑑の一覧表示", () => {
  describe("正常系", () => {
    describe("ポケモンを 2 匹見つけ、うち 1 匹だけ捕まえているとき", () => {
      function mockOneCapturedOneEncountered() {
        mockPokedex(
          [makeEntry(1, "Bulbasaur", "フシギダネ"), { ...makeEntry(4, "Charmander", "ヒトカゲ"), status: "encountered" }],
          1,
          0,
        );
      }

      it("2 匹のカードが一覧に表示される", async () => {
        mockOneCapturedOneEncountered();

        render(<PokedexPage />);

        expect(await screen.findByText("フシギダネ")).toBeInTheDocument();
        expect(screen.getByText("ヒトカゲ")).toBeInTheDocument();
      });

      it("「見つけた数 2種類」「捕まえた数 1種類」と表示される", async () => {
        mockOneCapturedOneEncountered();

        render(<PokedexPage />);

        expect(await screen.findByText("見つけた数 2種類")).toBeInTheDocument();
        expect(screen.getByText("捕まえた数 1種類")).toBeInTheDocument();
      });
    });

    it("読み込めなかったポケモンが 0 匹のとき、「読み込めませんでした」を含むメッセージが表示されない", async () => {
      mockPokedex([makeEntry(1, "Bulbasaur", "フシギダネ")], 1, 0);

      render(<PokedexPage />);

      // 読み込みの完了を待ってから不在を確かめるため、カードが表示されるのを待つ
      await screen.findByText("フシギダネ");
      expect(screen.queryByText(/読み込めませんでした/)).not.toBeInTheDocument();
    });

    it("図鑑のポケモンが 0 匹のとき、「まだポケモンに出会っていません」と表示される", async () => {
      mockPokedex([], 0, 0);

      render(<PokedexPage />);

      expect(
        await screen.findByText(spec("まだポケモンに出会っていません")),
      ).toBeInTheDocument();
    });
  });

  describe("異常系", () => {
    it("読み込めなかったポケモンが 1 匹のとき、「1匹読み込めませんでした。あとでもう一度試してください」と表示される", async () => {
      mockPokedex([makeEntry(1, "Bulbasaur", "フシギダネ")], 1, 1);

      render(<PokedexPage />);

      expect(
        await screen.findByText(
          spec("1匹読み込めませんでした。あとでもう一度試してください"),
        ),
      ).toBeInTheDocument();
    });

    it("図鑑の一覧の取得に失敗したとき、「図鑑の読み込みに失敗しました」と表示される", async () => {
      // エラー経路の診断ログは検証対象外のため、テスト出力を汚さないよう沈黙させる
      vi.spyOn(console, "error").mockImplementation(() => {});
      server.use(http.get(apiUrl("/pokedex"), () => HttpResponse.error()));

      render(<PokedexPage />);

      expect(
        await screen.findByText(spec("図鑑の読み込みに失敗しました")),
      ).toBeInTheDocument();
      expect(screen.queryByTestId("pokemon-card")).not.toBeInTheDocument();
    });
  });
});

describe("[図鑑] ポケモンの詳細表示", () => {
  describe("正常系", () => {
    describe("一覧のカードを選んだとき", () => {
      async function selectBulbasaurCard() {
        mockPokedex([makeEntry(1, "Bulbasaur", "フシギダネ")], 1, 0);
        mockDetail(dummyDetail);
        const user = userEvent.setup();

        render(<PokedexPage />);

        await user.click(await screen.findByRole("button", { name: /フシギダネ/ }));
      }

      it("詳細モーダルに、そのポケモンの説明文が表示される", async () => {
        await selectBulbasaurCard();

        expect(
          await screen.findByText(
            spec("「生まれたときから　背中に 不思議な　タネが　植えてあって 体と　ともに　育つという。」"),
          ),
        ).toBeInTheDocument();
      });

      it("詳細モーダルに、「閉じる」ボタンが表示される", async () => {
        await selectBulbasaurCard();

        await screen.findByText(
          spec("「生まれたときから　背中に 不思議な　タネが　植えてあって 体と　ともに　育つという。」"),
        );
        expect(screen.getByRole("button", { name: "閉じる" })).toBeInTheDocument();
      });

      it("詳細モーダルに、持っているタイプの「くさ」が表示される", async () => {
        await selectBulbasaurCard();

        await screen.findByText(
          spec("「生まれたときから　背中に 不思議な　タネが　植えてあって 体と　ともに　育つという。」"),
        );
        expect(screen.getByText("くさ")).toBeInTheDocument();
      });
    });

    it("詳細モーダルが開いているとき、「閉じる」を押すと、モーダルが閉じて一覧が表示される", async () => {
      mockPokedex([makeEntry(1, "Bulbasaur", "フシギダネ")], 1, 0);
      mockDetail(dummyDetail);
      const user = userEvent.setup();

      render(<PokedexPage />);

      await user.click(await screen.findByRole("button", { name: /フシギダネ/ }));
      await user.click(await screen.findByRole("button", { name: "閉じる" }));

      await waitFor(() =>
        expect(
          screen.queryByText(
            spec("「生まれたときから　背中に 不思議な　タネが　植えてあって 体と　ともに　育つという。」"),
          ),
        ).not.toBeInTheDocument(),
      );
      expect(screen.getByRole("button", { name: /フシギダネ/ })).toBeInTheDocument();
    });
  });

  describe("異常系", () => {
    it("ポケモンの詳細の取得に失敗するとき、一覧のカードを選ぶと、「ポケモンの詳細の読み込みに失敗しました」と表示される", async () => {
      // エラー経路の診断ログは検証対象外のため、テスト出力を汚さないよう沈黙させる
      vi.spyOn(console, "error").mockImplementation(() => {});
      mockPokedex([makeEntry(1, "Bulbasaur", "フシギダネ")], 1, 0);
      server.use(http.get(apiUrl("/pokedex/:id"), () => HttpResponse.error()));
      const user = userEvent.setup();

      render(<PokedexPage />);

      await user.click(await screen.findByRole("button", { name: /フシギダネ/ }));

      expect(
        await screen.findByText(spec("ポケモンの詳細の読み込みに失敗しました")),
      ).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "閉じる" })).not.toBeInTheDocument();
    });
  });
});
