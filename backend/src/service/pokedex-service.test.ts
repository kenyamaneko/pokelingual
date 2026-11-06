import { describe, expect } from "vitest";
import { PokedexService } from "./pokedex-service.js";
import type {
  PokemonClient,
  UserPokemonRepository,
  UserSettingsRepository,
} from "../domain/ports.js";
import type { UserPokemon } from "../domain/user.js";
import { makePokemon } from "../testing/pokemon-fixtures.js";
import { defineCase, type Viewpoint } from "../test/defineCase.js";

const REAL_NAMES: Record<number, { name_en: string; name_ja: string }> = {
  1: { name_en: "Bulbasaur", name_ja: "フシギダネ" },
  2: { name_en: "Ivysaur", name_ja: "フシギソウ" },
  3: { name_en: "Venusaur", name_ja: "フシギバナ" },
  152: { name_en: "Chikorita", name_ja: "チコリータ" },
};

/**
 * テスト用のダミー図鑑レコードを作る。
 */
function makeUserPokemon(overrides: Partial<UserPokemon> = {}): UserPokemon {
  return {
    pokemon_id: 1,
    status: "captured",
    total_captures: 2,
    total_encounters: 3,
    last_captured_at: null,
    last_encountered_at: new Date("2026-01-02T03:04:05Z"),
    best_score: 80,
    ...overrides,
  };
}

interface ServiceOverrides {
  /** リポジトリが返す図鑑レコード一覧。 */
  records?: UserPokemon[];
  /** メタ情報の取得が失敗するポケモン ID の集合。 */
  failingIDs?: number[];
  /** ユーザーが設定で除外した図鑑 ID。 */
  excludedIDs?: number[];
  /** ユーザーが設定で選択した出題世代。 */
  enabledGenerations?: number[];
  /** データソースが取得できる図鑑番号。 */
  servableIDs?: number[];
}

/**
 * スタブを注入した PokedexService を組み立てる。
 */
function makeService(o: ServiceOverrides = {}): PokedexService {
  const failing = new Set(o.failingIDs ?? []);
  const repo: UserPokemonRepository = {
    upsertEncounter: async () => {},
    getPokedex: async () => o.records ?? [],
    getPokemon: async (_userId, pokemonID) => {
      const found = (o.records ?? []).find((r) => r.pokemon_id === pokemonID);
      if (!found) throw new Error(`not found: ${pokemonID}`);
      return found;
    },
  };
  const pokemonClient: PokemonClient = {
    getPokemonByID: async (id) => {
      if (failing.has(id)) throw new Error("pokemon data unavailable");
      // ポケモンの名前と画像を図鑑番号ごとに変え、どの記録にどのポケモンの名前・画像が付いたかを確かめられるようにするため。
      return makePokemon({
        id,
        ...REAL_NAMES[id],
        sprite_url: `https://example.com/${id}.png`,
      });
    },
    getServableIDs: () => o.servableIDs ?? [],
    getIDsByType: async () => [],
  };
  const settingsRepo: UserSettingsRepository = {
    getSettings: async () => ({
      excluded_pokemon_ids: o.excludedIDs ?? null,
      enabled_generations: o.enabledGenerations ?? null,
    }),
    updateExcludedPokemon: async () => {},
    updateEnabledGenerations: async () => {},
  };
  return new PokedexService(repo, pokemonClient, settingsRepo);
}

const GET_POKEDEX = "図鑑画面を開くために、図鑑一覧を取得する";
const GET_SEARCH_CANDIDATES = "設定画面の苦手ポケモン設定で、ポケモンの名前で探すために、名前検索の候補を取得する";
const GET_POKEMON_DETAIL = "図鑑画面でポケモンの詳細を開くために、図鑑番号 1 の図鑑詳細を取得する";

const NO_RECORDS = "図鑑に記録が 1 件も無いとき";
const SINGLE_RECORD = "図鑑番号 1 の記録 (捕獲済み・捕獲回数 2・最高スコア 90) が 1 件あるとき";
const TWO_RECORDS =
  "図鑑番号 1 (捕獲済み・捕獲回数 5・最高スコア 90) と図鑑番号 2 (未捕獲・捕獲回数 0・最高スコア 40) の記録があるとき";
const THREE_RECORDS_WITH_SECOND_EXCLUDED =
  "図鑑番号 1、2、3 の記録があり、図鑑番号 2 を除外ポケモンに設定しているとき";
const SECOND_UNREADABLE = "図鑑番号 1、2、3 の記録があり、図鑑番号 2 のポケモンの名前・画像を読み込めないとき";
const ALL_UNREADABLE = "図鑑番号 1、2 の記録があり、どちらのポケモンの名前・画像も読み込めないとき";

const getSingleRecordEntries = async () => {
  const service = makeService({
    records: [makeUserPokemon({ pokemon_id: 1, best_score: 90 })],
  });
  return (await service.getPokedex("alice")).entries;
};

const getTwoRecordsEntries = async () => {
  const service = makeService({
    records: [
      makeUserPokemon({ pokemon_id: 1, status: "captured", total_captures: 5, best_score: 90 }),
      makeUserPokemon({ pokemon_id: 2, status: "seen", total_captures: 0, best_score: 40 }),
    ],
  });
  return (await service.getPokedex("alice")).entries;
};

const makePartiallyFailingService = () =>
  makeService({
    records: [
      makeUserPokemon({ pokemon_id: 1 }),
      makeUserPokemon({ pokemon_id: 2 }),
      makeUserPokemon({ pokemon_id: 3 }),
    ],
    failingIDs: [2],
  });

const makeAllFailingService = () =>
  makeService({
    records: [makeUserPokemon({ pokemon_id: 1 }), makeUserPokemon({ pokemon_id: 2 })],
    failingIDs: [1, 2],
  });

describe("[本体:図鑑]図鑑一覧の取得", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["件数・有無"],
      steps: [{ Given: NO_RECORDS, When: [GET_POKEDEX], Then: "図鑑一覧は空になる" }],
    },
    async () => {
      const res = await makeService().getPokedex("alice");
      expect(res.entries).toEqual([]);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: THREE_RECORDS_WITH_SECOND_EXCLUDED,
          When: [GET_POKEDEX],
          Then: "図鑑一覧は図鑑番号 1 と 3 の 2 項目になる",
        },
      ],
    },
    async () => {
      const service = makeService({
        records: [
          makeUserPokemon({ pokemon_id: 1 }),
          makeUserPokemon({ pokemon_id: 2 }),
          makeUserPokemon({ pokemon_id: 3 }),
        ],
        excludedIDs: [2],
      });
      const res = await service.getPokedex("alice");
      expect(res.entries.map((e) => e.pokemon_id)).toEqual([1, 3]);
    },
  );

  for (const { given, overrides, viewpoints } of [
    { given: NO_RECORDS, overrides: {}, viewpoints: ["件数・有無"] },
    {
      given: "図鑑番号 1 の記録が 1 件あるとき",
      overrides: { records: [makeUserPokemon({ pokemon_id: 1 })] },
      viewpoints: ["件数・有無"],
    },
    {
      given: "図鑑番号 1 と 2 の記録があるとき",
      overrides: { records: [makeUserPokemon({ pokemon_id: 1 }), makeUserPokemon({ pokemon_id: 2 })] },
      viewpoints: ["件数・有無"],
    },
    {
      given: THREE_RECORDS_WITH_SECOND_EXCLUDED,
      viewpoints: [],
      overrides: {
        records: [
          makeUserPokemon({ pokemon_id: 1 }),
          makeUserPokemon({ pokemon_id: 2 }),
          makeUserPokemon({ pokemon_id: 3 }),
        ],
        excludedIDs: [2],
      },
    },
  ] as { given: string; overrides: ServiceOverrides; viewpoints: Viewpoint[] }[]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        観点: viewpoints,
        steps: [{ Given: given, When: [GET_POKEDEX], Then: "読み込めなかったポケモンの数は 0 になる" }],
      },
      async () => {
        const res = await makeService(overrides).getPokedex("alice");
        expect(res.unavailable_count).toBe(0);
      },
    );
  }

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: SINGLE_RECORD, When: [GET_POKEDEX], Then: "図鑑一覧は、図鑑番号 1 の 1 項目だけになる" }],
    },
    async () => {
      const entries = await getSingleRecordEntries();
      expect(entries.map((e) => e.pokemon_id)).toEqual([1]);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: SINGLE_RECORD, When: [GET_POKEDEX], Then: "図鑑一覧の項目の英語名は Bulbasaur になる" }],
    },
    async () => {
      const entries = await getSingleRecordEntries();
      expect(entries.map((e) => e.name_en)).toEqual(["Bulbasaur"]);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: SINGLE_RECORD, When: [GET_POKEDEX], Then: "図鑑一覧の項目の日本語名はフシギダネになる" }],
    },
    async () => {
      const entries = await getSingleRecordEntries();
      expect(entries.map((e) => e.name_ja)).toEqual(["フシギダネ"]);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: SINGLE_RECORD,
          When: [GET_POKEDEX],
          Then: "図鑑一覧の項目の画像の URL は https://example.com/1.png になる",
        },
      ],
    },
    async () => {
      const entries = await getSingleRecordEntries();
      expect(entries.map((e) => e.sprite_url)).toEqual(["https://example.com/1.png"]);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: SINGLE_RECORD, When: [GET_POKEDEX], Then: "図鑑一覧の項目の捕獲状況は捕獲済みになる" }],
    },
    async () => {
      const entries = await getSingleRecordEntries();
      expect(entries.map((e) => e.status)).toEqual(["captured"]);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: SINGLE_RECORD, When: [GET_POKEDEX], Then: "図鑑一覧の項目の捕獲回数は 2 になる" }],
    },
    async () => {
      const entries = await getSingleRecordEntries();
      expect(entries.map((e) => e.total_captures)).toEqual([2]);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: SINGLE_RECORD, When: [GET_POKEDEX], Then: "図鑑一覧の項目の最高スコアは 90 になる" }],
    },
    async () => {
      const entries = await getSingleRecordEntries();
      expect(entries.map((e) => e.best_score)).toEqual([90]);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: TWO_RECORDS,
          When: [GET_POKEDEX],
          Then: "図鑑一覧は、記録の並びのまま図鑑番号 1、2 の 2 項目になる",
        },
      ],
    },
    async () => {
      const entries = await getTwoRecordsEntries();
      expect(entries.map((e) => e.pokemon_id)).toEqual([1, 2]);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: TWO_RECORDS, When: [GET_POKEDEX], Then: "図鑑一覧の英語名は、Bulbasaur、Ivysaur の順になる" }],
    },
    async () => {
      const entries = await getTwoRecordsEntries();
      expect(entries.map((e) => e.name_en)).toEqual(["Bulbasaur", "Ivysaur"]);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        { Given: TWO_RECORDS, When: [GET_POKEDEX], Then: "図鑑一覧の日本語名は、フシギダネ、フシギソウの順になる" },
      ],
    },
    async () => {
      const entries = await getTwoRecordsEntries();
      expect(entries.map((e) => e.name_ja)).toEqual(["フシギダネ", "フシギソウ"]);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: TWO_RECORDS,
          When: [GET_POKEDEX],
          Then: "図鑑一覧の画像の URL は、https://example.com/1.png、https://example.com/2.png の順になる",
        },
      ],
    },
    async () => {
      const entries = await getTwoRecordsEntries();
      expect(entries.map((e) => e.sprite_url)).toEqual([
        "https://example.com/1.png",
        "https://example.com/2.png",
      ]);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: TWO_RECORDS, When: [GET_POKEDEX], Then: "図鑑一覧の捕獲状況は、捕獲済み、未捕獲の順になる" }],
    },
    async () => {
      const entries = await getTwoRecordsEntries();
      expect(entries.map((e) => e.status)).toEqual(["captured", "seen"]);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: TWO_RECORDS, When: [GET_POKEDEX], Then: "図鑑一覧の捕獲回数は、5、0 の順になる" }],
    },
    async () => {
      const entries = await getTwoRecordsEntries();
      expect(entries.map((e) => e.total_captures)).toEqual([5, 0]);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: TWO_RECORDS, When: [GET_POKEDEX], Then: "図鑑一覧の最高スコアは、90、40 の順になる" }],
    },
    async () => {
      const entries = await getTwoRecordsEntries();
      expect(entries.map((e) => e.best_score)).toEqual([90, 40]);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      観点: ["外部依存の失敗"],
      steps: [
        { Given: SECOND_UNREADABLE, When: [GET_POKEDEX], Then: "図鑑一覧は図鑑番号 1 と 3 の 2 項目になる" },
      ],
    },
    async () => {
      const res = await makePartiallyFailingService().getPokedex("alice");
      expect(res.entries.map((e) => e.pokemon_id)).toEqual([1, 3]);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      観点: ["外部依存の失敗"],
      steps: [{ Given: SECOND_UNREADABLE, When: [GET_POKEDEX], Then: "読み込めなかったポケモンの数は 1 になる" }],
    },
    async () => {
      const res = await makePartiallyFailingService().getPokedex("alice");
      expect(res.unavailable_count).toBe(1);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      観点: ["外部依存の失敗"],
      steps: [{ Given: ALL_UNREADABLE, When: [GET_POKEDEX], Then: "図鑑一覧は空になる" }],
    },
    async () => {
      const res = await makeAllFailingService().getPokedex("alice");
      expect(res.entries).toEqual([]);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      観点: ["外部依存の失敗"],
      steps: [{ Given: ALL_UNREADABLE, When: [GET_POKEDEX], Then: "読み込めなかったポケモンの数は 2 になる" }],
    },
    async () => {
      const res = await makeAllFailingService().getPokedex("alice");
      expect(res.unavailable_count).toBe(2);
    },
  );
});

describe("[共通:設定]名前検索の候補ポケモン", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "ポケモンデータに図鑑番号 1 と 2 のポケモンがあるとき",
          When: [GET_SEARCH_CANDIDATES],
          Then: "名前検索の候補は、図鑑番号 1・日本語名フシギダネと図鑑番号 2・日本語名フシギソウの 2 件になり、各候補は図鑑番号と日本語名だけを持つ",
        },
      ],
    },
    async () => {
      const service = makeService({ servableIDs: [1, 2] });
      const res = await service.getSearchCandidates();
      expect(res).toEqual([
        { pokemon_id: 1, name_ja: "フシギダネ" },
        { pokemon_id: 2, name_ja: "フシギソウ" },
      ]);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "図鑑番号 1 を除外ポケモンに設定していて、ポケモンデータに図鑑番号 1 と 2 のポケモンがあるとき",
          When: [GET_SEARCH_CANDIDATES],
          Then: "名前検索の候補の図鑑番号は 1、2 の順になる",
        },
      ],
    },
    async () => {
      const service = makeService({ servableIDs: [1, 2], excludedIDs: [1] });
      const res = await service.getSearchCandidates();
      expect(res.map((p) => p.pokemon_id)).toEqual([1, 2]);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "出題世代に第 1 世代だけを選んでいて、ポケモンデータに図鑑番号 1 と 152 のポケモンがあるとき",
          When: [GET_SEARCH_CANDIDATES],
          Then: "名前検索の候補の図鑑番号は 1、152 の順になる",
        },
      ],
    },
    async () => {
      const service = makeService({ servableIDs: [1, 152], enabledGenerations: [1] });
      const res = await service.getSearchCandidates();
      expect(res.map((p) => p.pokemon_id)).toEqual([1, 152]);
    },
  );
});

const makeDetailService = (overrides: Partial<UserPokemon> = {}) =>
  makeService({
    records: [
      makeUserPokemon({
        pokemon_id: 1,
        last_captured_at: new Date("2026-03-04T05:06:07Z"),
        last_encountered_at: new Date("2026-03-05T06:07:08Z"),
        ...overrides,
      }),
    ],
  });

const DETAIL_RECORD_STATS =
  "ユーザーの図鑑に図鑑番号 1 の記録があり、記録が捕獲済み・捕獲回数 2・遭遇回数 3・最高スコア 80 のとき";
const DETAIL_RECORD_DATES =
  "ユーザーの図鑑に図鑑番号 1 の記録があり、最終捕獲日時が 2026-03-04 05:06:07 (UTC)、最終遭遇日時が 2026-03-05 06:07:08 (UTC) のとき";
const DETAIL_POKEMON_DATA =
  "ユーザーの図鑑に図鑑番号 1 の記録があり、ポケモンデータの図鑑番号 1 が英語名 Bulbasaur・日本語名フシギダネ・タイプくさとどくのとき";

describe("[本体:図鑑]図鑑詳細の取得", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: DETAIL_RECORD_STATS, When: [GET_POKEMON_DETAIL], Then: "図鑑詳細の図鑑番号は 1 になる" }],
    },
    async () => {
      const res = await makeDetailService().getPokemonDetail("alice", 1);
      expect(res.pokemon_id).toBe(1);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: DETAIL_RECORD_STATS, When: [GET_POKEMON_DETAIL], Then: "図鑑詳細の捕獲状況は捕獲済みになる" }],
    },
    async () => {
      const res = await makeDetailService().getPokemonDetail("alice", 1);
      expect(res.status).toBe("captured");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: DETAIL_RECORD_STATS, When: [GET_POKEMON_DETAIL], Then: "図鑑詳細の捕獲回数は 2 になる" }],
    },
    async () => {
      const res = await makeDetailService().getPokemonDetail("alice", 1);
      expect(res.total_captures).toBe(2);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: DETAIL_RECORD_STATS, When: [GET_POKEMON_DETAIL], Then: "図鑑詳細の遭遇回数は 3 になる" }],
    },
    async () => {
      const res = await makeDetailService().getPokemonDetail("alice", 1);
      expect(res.total_encounters).toBe(3);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: DETAIL_RECORD_STATS, When: [GET_POKEMON_DETAIL], Then: "図鑑詳細の最高スコアは 80 になる" }],
    },
    async () => {
      const res = await makeDetailService().getPokemonDetail("alice", 1);
      expect(res.best_score).toBe(80);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: DETAIL_RECORD_DATES,
          When: [GET_POKEMON_DETAIL],
          Then: '図鑑詳細の最終捕獲日時は "2026-03-04T05:06:07.000Z" の文字列になる',
        },
      ],
    },
    async () => {
      const res = await makeDetailService().getPokemonDetail("alice", 1);
      expect(res.last_captured_at).toBe("2026-03-04T05:06:07.000Z");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: DETAIL_RECORD_DATES,
          When: [GET_POKEMON_DETAIL],
          Then: '図鑑詳細の最終遭遇日時は "2026-03-05T06:07:08.000Z" の文字列になる',
        },
      ],
    },
    async () => {
      const res = await makeDetailService().getPokemonDetail("alice", 1);
      expect(res.last_encountered_at).toBe("2026-03-05T06:07:08.000Z");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: DETAIL_POKEMON_DATA, When: [GET_POKEMON_DETAIL], Then: "図鑑詳細の英語名は Bulbasaur になる" }],
    },
    async () => {
      const res = await makeDetailService().getPokemonDetail("alice", 1);
      expect(res.name_en).toBe("Bulbasaur");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        { Given: DETAIL_POKEMON_DATA, When: [GET_POKEMON_DETAIL], Then: "図鑑詳細の日本語名はフシギダネになる" },
      ],
    },
    async () => {
      const res = await makeDetailService().getPokemonDetail("alice", 1);
      expect(res.name_ja).toBe("フシギダネ");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: DETAIL_POKEMON_DATA,
          When: [GET_POKEMON_DETAIL],
          Then: "図鑑詳細のタイプは grass と poison (くさ・どく) になる",
        },
      ],
    },
    async () => {
      const res = await makeDetailService().getPokemonDetail("alice", 1);
      expect(res.types).toEqual(["grass", "poison"]);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["件数・有無"],
      steps: [
        {
          Given: "ユーザーの図鑑に図鑑番号 1 の記録があり、最終捕獲日時が記録されていないとき",
          When: [GET_POKEMON_DETAIL],
          Then: "図鑑詳細の最終捕獲日時は空 (null) になる",
        },
      ],
    },
    async () => {
      const res = await makeDetailService({ last_captured_at: null }).getPokemonDetail("alice", 1);
      expect(res.last_captured_at).toBeNull();
    },
  );
});
