import { describe, it, expect } from "vitest";
import { PokedexService } from "./pokedex-service.js";
import type {
  PokemonClient,
  UserPokemonRepository,
  UserSettingsRepository,
} from "../domain/ports.js";
import type { UserPokemon } from "../domain/user.js";
import { makePokemon } from "../testing/pokemon-fixtures.js";

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

describe("[図鑑] 図鑑一覧の取得", () => {
  describe("正常系", () => {
    describe("図鑑に記録が 1 件も無いとき", () => {
      it("取得結果の一覧は空になる", async () => {
        const res = await makeService().getPokedex("alice");
        expect(res.entries).toEqual([]);
      });

      it("読み込めなかったポケモンの数は 0 になる", async () => {
        const res = await makeService().getPokedex("alice");
        expect(res.unavailable_count).toBe(0);
      });
    });

    describe("図鑑番号 1 の記録 (捕獲済み・捕獲回数 2・最高スコア 90) が 1 件あるとき", () => {
      const makeSingleRecordService = () =>
        makeService({
          records: [makeUserPokemon({ pokemon_id: 1, best_score: 90 })],
        });

      it("取得結果の一覧は、その記録に図鑑番号 1 のポケモンの名前と画像の URL を加えた 1 項目になる", async () => {
        const res = await makeSingleRecordService().getPokedex("alice");
        expect(res.entries).toEqual([
          {
            pokemon_id: 1,
            name_en: "Bulbasaur",
            name_ja: "フシギダネ",
            sprite_url: "https://example.com/1.png",
            status: "captured",
            total_captures: 2,
            best_score: 90,
          },
        ]);
      });

      it("読み込めなかったポケモンの数は 0 になる", async () => {
        const res = await makeSingleRecordService().getPokedex("alice");
        expect(res.unavailable_count).toBe(0);
      });
    });

    describe("図鑑番号 1 (捕獲済み・捕獲回数 5・最高スコア 90) と図鑑番号 2 (未捕獲・捕獲回数 0・最高スコア 40) の記録があるとき", () => {
      const makeTwoRecordsService = () =>
        makeService({
          records: [
            makeUserPokemon({ pokemon_id: 1, status: "captured", total_captures: 5, best_score: 90 }),
            makeUserPokemon({ pokemon_id: 2, status: "seen", total_captures: 0, best_score: 40 }),
          ],
        });

      it("取得結果の一覧は、記録の並びのまま図鑑番号 1、2 の 2 項目になり、それぞれに名前と画像の URL、その記録の捕獲状況・捕獲回数・最高スコアが付く", async () => {
        const res = await makeTwoRecordsService().getPokedex("alice");
        expect(res.entries).toEqual([
          {
            pokemon_id: 1,
            name_en: "Bulbasaur",
            name_ja: "フシギダネ",
            sprite_url: "https://example.com/1.png",
            status: "captured",
            total_captures: 5,
            best_score: 90,
          },
          {
            pokemon_id: 2,
            name_en: "Ivysaur",
            name_ja: "フシギソウ",
            sprite_url: "https://example.com/2.png",
            status: "seen",
            total_captures: 0,
            best_score: 40,
          },
        ]);
      });

      it("読み込めなかったポケモンの数は 0 になる", async () => {
        const res = await makeTwoRecordsService().getPokedex("alice");
        expect(res.unavailable_count).toBe(0);
      });
    });

    describe("図鑑番号 1、2、3 の記録があり、図鑑番号 2 を除外ポケモンに設定しているとき", () => {
      const makeExcludedService = () =>
        makeService({
          records: [
            makeUserPokemon({ pokemon_id: 1 }),
            makeUserPokemon({ pokemon_id: 2 }),
            makeUserPokemon({ pokemon_id: 3 }),
          ],
          excludedIDs: [2],
        });

      it("取得結果の一覧は図鑑番号 1 と 3 の項目になる", async () => {
        const res = await makeExcludedService().getPokedex("alice");
        expect(res.entries.map((e) => e.pokemon_id)).toEqual([1, 3]);
      });

      it("読み込めなかったポケモンの数は 0 になる", async () => {
        const res = await makeExcludedService().getPokedex("alice");
        expect(res.unavailable_count).toBe(0);
      });
    });
  });

  describe("異常系", () => {
    describe("図鑑番号 1、2、3 の記録があり、図鑑番号 2 のポケモンの名前・画像を読み込めないとき", () => {
      const makePartiallyFailingService = () =>
        makeService({
          records: [
            makeUserPokemon({ pokemon_id: 1 }),
            makeUserPokemon({ pokemon_id: 2 }),
            makeUserPokemon({ pokemon_id: 3 }),
          ],
          failingIDs: [2],
        });

      it("取得結果の一覧は図鑑番号 1 と 3 の項目になる", async () => {
        const res = await makePartiallyFailingService().getPokedex("alice");
        expect(res.entries.map((e) => e.pokemon_id)).toEqual([1, 3]);
      });

      it("読み込めなかったポケモンの数は 1 になる", async () => {
        const res = await makePartiallyFailingService().getPokedex("alice");
        expect(res.unavailable_count).toBe(1);
      });
    });

    describe("図鑑番号 1、2 の記録があり、どちらのポケモンの名前・画像も読み込めないとき", () => {
      const makeAllFailingService = () =>
        makeService({
          records: [makeUserPokemon({ pokemon_id: 1 }), makeUserPokemon({ pokemon_id: 2 })],
          failingIDs: [1, 2],
        });

      it("取得結果の一覧は空になる", async () => {
        const res = await makeAllFailingService().getPokedex("alice");
        expect(res.entries).toEqual([]);
      });

      it("読み込めなかったポケモンの数は 2 になる", async () => {
        const res = await makeAllFailingService().getPokedex("alice");
        expect(res.unavailable_count).toBe(2);
      });
    });
  });
});

describe("[苦手ポケモン検索] 名前検索の対象ポケモンの取得", () => {
  describe("正常系", () => {
    it("取得できるポケモンが図鑑番号 1 と 2 のとき、取得結果はそれぞれの図鑑番号と日本語名だけの組になる", async () => {
      const service = makeService({ servableIDs: [1, 2] });
      const res = await service.getSearchCandidates();
      expect(res).toEqual([
        { pokemon_id: 1, name_ja: "フシギダネ" },
        { pokemon_id: 2, name_ja: "フシギソウ" },
      ]);
    });

    it("図鑑番号 1 を除外ポケモンに設定していて、取得できるポケモンが図鑑番号 1 と 2 のとき、取得結果に図鑑番号 1 と 2 の両方が含まれる", async () => {
      const service = makeService({ servableIDs: [1, 2], excludedIDs: [1] });
      const res = await service.getSearchCandidates();
      expect(res.map((p) => p.pokemon_id)).toEqual([1, 2]);
    });

    it("出題世代に第 1 世代だけを選んでいて、取得できるポケモンが図鑑番号 1 と 152 のとき、取得結果に図鑑番号 1 と 152 の両方が含まれる", async () => {
      const service = makeService({ servableIDs: [1, 152], enabledGenerations: [1] });
      const res = await service.getSearchCandidates();
      expect(res.map((p) => p.pokemon_id)).toEqual([1, 152]);
    });
  });
});

describe("[図鑑] 図鑑詳細の取得", () => {
  describe("正常系", () => {
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

    it("図鑑番号 1 の記録が捕獲済み・捕獲回数 2・遭遇回数 3・最高スコア 80 のとき、詳細の取得結果に同じ捕獲状況・捕獲回数・遭遇回数・最高スコアが含まれる", async () => {
      const res = await makeDetailService().getPokemonDetail("alice", 1);
      expect(res).toMatchObject({
        pokemon_id: 1,
        status: "captured",
        total_captures: 2,
        total_encounters: 3,
        best_score: 80,
      });
    });

    it('最終捕獲日時が 2026-03-04 05:06:07 (UTC)、最終遭遇日時が 2026-03-05 06:07:08 (UTC) のとき、詳細の取得結果の日時は "2026-03-04T05:06:07.000Z" と "2026-03-05T06:07:08.000Z" の文字列になる', async () => {
      const res = await makeDetailService().getPokemonDetail("alice", 1);
      expect(res).toMatchObject({
        last_captured_at: "2026-03-04T05:06:07.000Z",
        last_encountered_at: "2026-03-05T06:07:08.000Z",
      });
    });

    it("図鑑番号 1 のポケモンのとき、詳細の取得結果に英語名 Bulbasaur・日本語名フシギダネ・タイプくさとどくが含まれる", async () => {
      const res = await makeDetailService().getPokemonDetail("alice", 1);
      expect(res).toMatchObject({
        name_en: "Bulbasaur",
        name_ja: "フシギダネ",
        types: ["grass", "poison"],
      });
    });

    it("最終捕獲日時が記録されていないとき、詳細の取得結果の最終捕獲日時は空になる", async () => {
      const service = makeService({
        records: [makeUserPokemon({ pokemon_id: 1, last_captured_at: null })],
      });
      const res = await service.getPokemonDetail("alice", 1);
      expect(res.last_captured_at).toBeNull();
    });
  });
});
