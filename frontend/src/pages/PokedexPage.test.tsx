import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, vi, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { PokedexPage } from "./PokedexPage";
import { server, apiUrl } from "../test/mswServer";
import { spec } from "../test/labels";
import { defineCase } from "../test/defineCase";
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

const OPEN_POKEDEX = "図鑑画面を開く";
const SELECT_BULBASAUR_CARD = "図鑑画面の一覧で、「フシギダネ」のカードを選ぶ";
const CLOSE_DETAIL_MODAL = "図鑑画面の詳細モーダルで、「閉じる」ボタンを押す";
const BULBASAUR_IN_POKEDEX = "図鑑に「フシギダネ」があり";
const POKEDEX_UNAVAILABLE = "図鑑の一覧を読み込めないとき";
const DESCRIPTION_TEXT = "「生まれたときから　背中に 不思議な　タネが　植えてあって 体と　ともに　育つという。」";
const POKEDEX_LOAD_FAILED = "「図鑑の読み込みに失敗しました」と表示される";
const DETAIL_LOAD_FAILED = "「ポケモンの詳細の読み込みに失敗しました」と表示される";

function mockOneCapturedOneEncountered() {
  mockPokedex(
    [makeEntry(1, "Bulbasaur", "フシギダネ"), { ...makeEntry(4, "Charmander", "ヒトカゲ"), status: "encountered" }],
    1,
    0,
  );
}

async function selectBulbasaurCard() {
  mockPokedex([makeEntry(1, "Bulbasaur", "フシギダネ")], 1, 0);
  mockDetail(dummyDetail);
  const user = userEvent.setup();

  render(<PokedexPage />);

  await user.click(await screen.findByRole("button", { name: /フシギダネ/ }));
}

async function closeDetailModal() {
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
}

describe("[本体:図鑑]図鑑の一覧表示", () => {
  const ONE_CAPTURED_ONE_ENCOUNTERED =
    "ポケモンを 2 匹見つけ、うち「フシギダネ」だけ捕まえていて「ヒトカゲ」は見つけただけのとき";

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: ONE_CAPTURED_ONE_ENCOUNTERED,
          When: [OPEN_POKEDEX],
          Then: "図鑑画面の一覧に、「フシギダネ」と「ヒトカゲ」のカードが表示される",
        },
      ],
    },
    async () => {
      mockOneCapturedOneEncountered();

      render(<PokedexPage />);

      expect(await screen.findByText("フシギダネ")).toBeInTheDocument();
      expect(screen.getByText("ヒトカゲ")).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [{ Given: ONE_CAPTURED_ONE_ENCOUNTERED, When: [OPEN_POKEDEX], Then: "「見つけた数 2種類」と表示される" }],
    },
    async () => {
      mockOneCapturedOneEncountered();

      render(<PokedexPage />);

      expect(await screen.findByText("見つけた数 2種類")).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [{ Given: ONE_CAPTURED_ONE_ENCOUNTERED, When: [OPEN_POKEDEX], Then: "「捕まえた数 1種類」と表示される" }],
    },
    async () => {
      mockOneCapturedOneEncountered();

      render(<PokedexPage />);

      expect(await screen.findByText("捕まえた数 1種類")).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      観点: ["件数・有無"],
      steps: [
        {
          Given: "読み込めなかったポケモンが 0 匹のとき",
          When: [OPEN_POKEDEX],
          Then: "「読み込めませんでした」を含むメッセージが表示されない",
        },
      ],
    },
    async () => {
      mockPokedex([makeEntry(1, "Bulbasaur", "フシギダネ")], 1, 0);

      render(<PokedexPage />);

      await screen.findByText("フシギダネ");
      expect(screen.queryByText(/読み込めませんでした/)).not.toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      観点: ["件数・有無"],
      steps: [
        {
          Given: "読み込めなかったポケモンが 1 匹のとき",
          When: [OPEN_POKEDEX],
          Then: "「1匹読み込めませんでした。あとでもう一度試してください」と表示される",
        },
      ],
    },
    async () => {
      mockPokedex([makeEntry(1, "Bulbasaur", "フシギダネ")], 1, 1);

      render(<PokedexPage />);

      expect(
        await screen.findByText(
          spec("1匹読み込めませんでした。あとでもう一度試してください"),
        ),
      ).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      観点: ["件数・有無"],
      steps: [
        {
          Given: "図鑑のポケモンが 0 匹のとき",
          When: [OPEN_POKEDEX],
          Then: "「まだポケモンに出会っていません」と表示される",
        },
      ],
    },
    async () => {
      mockPokedex([], 0, 0);

      render(<PokedexPage />);

      expect(
        await screen.findByText(spec("まだポケモンに出会っていません")),
      ).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      観点: ["外部依存の失敗"],
      steps: [{ Given: POKEDEX_UNAVAILABLE, When: [OPEN_POKEDEX], Then: POKEDEX_LOAD_FAILED }],
    },
    async () => {
      // エラー経路の診断ログは検証対象外のため、テスト出力を汚さないよう沈黙させる
      vi.spyOn(console, "error").mockImplementation(() => {});
      server.use(http.get(apiUrl("/pokedex"), () => HttpResponse.error()));

      render(<PokedexPage />);

      expect(
        await screen.findByText(spec("図鑑の読み込みに失敗しました")),
      ).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      観点: ["外部依存の失敗"],
      steps: [
        {
          Given: POKEDEX_UNAVAILABLE,
          When: [OPEN_POKEDEX],
          Then: "図鑑画面の一覧に、ポケモンのカードが表示されない",
        },
      ],
    },
    async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      server.use(http.get(apiUrl("/pokedex"), () => HttpResponse.error()));

      render(<PokedexPage />);

      await screen.findByText(spec("図鑑の読み込みに失敗しました"));
      expect(screen.queryByTestId("pokemon-card")).not.toBeInTheDocument();
    },
  );
});

describe("[本体:図鑑]ポケモンの詳細表示", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: `${BULBASAUR_IN_POKEDEX}、詳細の日本語の説明文が${DESCRIPTION_TEXT}のとき`,
          When: [SELECT_BULBASAUR_CARD],
          Then: `詳細モーダルに、説明文${DESCRIPTION_TEXT}が表示される`,
        },
      ],
    },
    async () => {
      await selectBulbasaurCard();

      expect(
        await screen.findByText(
          spec("「生まれたときから　背中に 不思議な　タネが　植えてあって 体と　ともに　育つという。」"),
        ),
      ).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "図鑑に「フシギダネ」があるとき",
          When: [SELECT_BULBASAUR_CARD],
          Then: "詳細モーダルに、「閉じる」ボタンが表示される",
        },
      ],
    },
    async () => {
      await selectBulbasaurCard();

      expect(await screen.findByRole("button", { name: "閉じる" })).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: `${BULBASAUR_IN_POKEDEX}、詳細のタイプに「くさ」が含まれるとき`,
          When: [SELECT_BULBASAUR_CARD],
          Then: "詳細モーダルに、タイプの「くさ」が表示される",
        },
      ],
    },
    async () => {
      await selectBulbasaurCard();

      await screen.findByRole("button", { name: "閉じる" });
      expect(screen.getByText("くさ")).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: `${BULBASAUR_IN_POKEDEX}、その詳細モーダルが開いていて、詳細の日本語の説明文が${DESCRIPTION_TEXT}のとき`,
          When: [CLOSE_DETAIL_MODAL],
          Then: `詳細モーダルの説明文${DESCRIPTION_TEXT}が表示されなくなる`,
        },
      ],
    },
    async () => {
      await closeDetailModal();

      expect(
        screen.queryByText(
          spec("「生まれたときから　背中に 不思議な　タネが　植えてあって 体と　ともに　育つという。」"),
        ),
      ).not.toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: `${BULBASAUR_IN_POKEDEX}、その詳細モーダルが開いているとき`,
          When: [CLOSE_DETAIL_MODAL],
          Then: "図鑑画面の一覧に、「フシギダネ」のカードが表示される",
        },
      ],
    },
    async () => {
      await closeDetailModal();

      expect(screen.getByRole("button", { name: /フシギダネ/ })).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      観点: ["外部依存の失敗"],
      steps: [
        {
          Given: `${BULBASAUR_IN_POKEDEX}、その詳細を読み込めないとき`,
          When: [SELECT_BULBASAUR_CARD],
          Then: DETAIL_LOAD_FAILED,
        },
      ],
    },
    async () => {
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
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      観点: ["外部依存の失敗"],
      steps: [
        {
          Given: `${BULBASAUR_IN_POKEDEX}、その詳細を読み込めないとき`,
          When: [SELECT_BULBASAUR_CARD],
          Then: "詳細モーダルに、「閉じる」ボタンが表示されない",
        },
      ],
    },
    async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      mockPokedex([makeEntry(1, "Bulbasaur", "フシギダネ")], 1, 0);
      server.use(http.get(apiUrl("/pokedex/:id"), () => HttpResponse.error()));
      const user = userEvent.setup();

      render(<PokedexPage />);

      await user.click(await screen.findByRole("button", { name: /フシギダネ/ }));

      await screen.findByText(spec("ポケモンの詳細の読み込みに失敗しました"));
      expect(screen.queryByRole("button", { name: "閉じる" })).not.toBeInTheDocument();
    },
  );
});
