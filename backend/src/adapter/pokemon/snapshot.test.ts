import { describe, it, expect } from "vitest";
import { SnapshotPokemonClient, loadPokemonSnapshot } from "./snapshot.js";
import type { PokemonRecord } from "../../domain/pokemon.js";
import type { PokemonType } from "../../../../shared/api-types/pokemon.js";

const REAL_NAMES: Record<number, { name_en: string; name_ja: string }> = {
  1: { name_en: "Bulbasaur", name_ja: "フシギダネ" },
  4: { name_en: "Charmander", name_ja: "ヒトカゲ" },
  25: { name_en: "Pikachu", name_ja: "ピカチュウ" },
};

function record(id: number, types: PokemonType[]): PokemonRecord {
  return {
    id,
    name_en: REAL_NAMES[id].name_en,
    name_ja: REAL_NAMES[id].name_ja,
    description_en: "en",
    description_ja: "ja",
    base_stat_total: 300,
    types,
    height: 4,
    weight: 60,
    is_legendary: false,
    is_mythical: false,
  };
}

describe("[ポケモンデータ] スナップショットからのポケモン取得", () => {
  describe("正常系", () => {
    it("スナップショットに図鑑番号 25 のポケモンがあるとき、図鑑番号 25 を指定すると、ポケモンの名前が「ピカチュウ」になる", async () => {
      const client = new SnapshotPokemonClient([record(25, ["electric"])]);
      expect((await client.getPokemonByID(25)).name_ja).toBe("ピカチュウ");
    });

    it("スナップショットに図鑑番号 25 のポケモンがあるとき、図鑑番号 25 を指定すると、画像の URL は https:// で始まり /25.png で終わる", async () => {
      const client = new SnapshotPokemonClient([record(25, ["electric"])]);
      const url = (await client.getPokemonByID(25)).sprite_url;
      expect(url).toMatch(/^https:\/\/.+\/25\.png$/);
    });
  });

  describe("異常系", () => {
    it("スナップショットに図鑑番号 25 のポケモンだけがあるとき、図鑑番号 999 を指定すると、スナップショットに無いことを示すエラーになる", async () => {
      const client = new SnapshotPokemonClient([record(25, ["electric"])]);
      await expect(client.getPokemonByID(999)).rejects.toThrow(/not found in snapshot/);
    });
  });
});

describe("[ポケモンデータ] 出題可能な図鑑番号", () => {
  describe("正常系", () => {
    it("スナップショットに図鑑番号 25、1、4 の順でポケモンがあるとき、出題可能な図鑑番号を取得すると、1、4、25 の昇順で得られる", () => {
      const client = new SnapshotPokemonClient([record(25, []), record(1, []), record(4, [])]);
      expect(client.getServableIDs()).toEqual([1, 4, 25]);
    });
  });
});

describe("[ポケモンデータ] タイプ別の図鑑番号", () => {
  describe("正常系", () => {
    it("くさ・どくタイプの 1 番、ほのおタイプの 4 番、でんきタイプの 25 番のポケモンがあるとき、ほのおタイプを指定すると、図鑑番号は 4 だけが得られる", async () => {
      const client = new SnapshotPokemonClient([
        record(1, ["grass", "poison"]),
        record(4, ["fire"]),
        record(25, ["electric"]),
      ]);
      expect(await client.getIDsByType("fire")).toEqual([4]);
    });

    it("ほのおタイプのポケモンだけがあるとき、みずタイプを指定すると、図鑑番号は 1 件も得られない", async () => {
      const client = new SnapshotPokemonClient([record(4, ["fire"])]);
      expect(await client.getIDsByType("water")).toEqual([]);
    });
  });
});

describe("[ポケモンデータ] スナップショットの読み込み", () => {
  describe("正常系", () => {
    it("図鑑番号 25 と 1 のポケモンが記録されたスナップショットを読み込むと、図鑑番号 25、1 のポケモンが記録された順に得られる", async () => {
      const records = await loadPokemonSnapshot(async () =>
        JSON.stringify([record(25, ["electric"]), record(1, ["grass"])]),
      );
      expect(records.map((r) => r.id)).toEqual([25, 1]);
    });
  });

  describe("異常系", () => {
    it("スナップショットの内容がポケモンの一覧になっていないとき、読み込むと、一覧であることを求めるエラーになる", async () => {
      await expect(loadPokemonSnapshot(async () => JSON.stringify({ id: 1 }))).rejects.toThrow(
        /must be a JSON array/,
      );
    });
  });
});
