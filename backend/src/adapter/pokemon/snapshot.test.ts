import { describe, expect } from "vitest";
import { SnapshotPokemonClient, loadPokemonSnapshot } from "./snapshot.js";
import type { PokemonRecord } from "../../domain/pokemon.js";
import type { PokemonType } from "../../../../shared/api-types/pokemon.js";
import { defineCase } from "../../test/defineCase.js";

const REAL_NAMES: Record<number, { name_en: string; name_ja: string; description_en: string; description_ja: string }> = {
  1: { name_en: "Bulbasaur", name_ja: "フシギダネ", description_en: "A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokémon.", description_ja: "生まれたときから　背中に 不思議な　タネが　植えてあって 体と　ともに　育つという。" },
  4: { name_en: "Charmander", name_ja: "ヒトカゲ", description_en: "The flame on its tail indicates Charmander’s life force. If it is healthy, the flame burns brightly.", description_ja: "尻尾の　炎は ヒトカゲの　生命力の　証。 元気だと　さかんに　燃えさかる。" },
  25: { name_en: "Pikachu", name_ja: "ピカチュウ", description_en: "When several of these Pokémon gather, their electricity could build and cause lightning storms.", description_ja: "何匹か　あつまっていると そこでは　強い　電気が　たまり 雷が　落ちることが　あるという。" },
};

function record(id: number, types: PokemonType[]): PokemonRecord {
  return {
    id,
    name_en: REAL_NAMES[id].name_en,
    name_ja: REAL_NAMES[id].name_ja,
    description_en: REAL_NAMES[id].description_en,
    description_ja: REAL_NAMES[id].description_ja,
    base_stat_total: 300,
    types,
    height: 4,
    weight: 60,
    is_legendary: false,
    is_mythical: false,
  };
}

describe("[共通:機能共通]スナップショットからのポケモン取得", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "スナップショットに図鑑番号 25 のポケモンがあるとき",
          When: ["図鑑番号 25 を指定してスナップショットからポケモンを取得する"],
          Then: "ポケモンの名前が「ピカチュウ」になる",
        },
      ],
    },
    async () => {
      const client = new SnapshotPokemonClient([record(25, ["electric"])]);
      expect((await client.getPokemonByID(25)).name_ja).toBe("ピカチュウ");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "スナップショットに図鑑番号 25 のポケモンがあるとき",
          When: ["図鑑番号 25 を指定してスナップショットからポケモンを取得する"],
          Then: "画像の URL は https:// で始まり /25.png で終わる",
        },
      ],
    },
    async () => {
      const client = new SnapshotPokemonClient([record(25, ["electric"])]);
      const url = (await client.getPokemonByID(25)).sprite_url;
      expect(url).toMatch(/^https:\/\/.+\/25\.png$/);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      観点: ["エッジケース"],
      steps: [
        {
          Given: "スナップショットに図鑑番号 25 のポケモンだけがあるとき",
          When: ["図鑑番号 999 を指定してスナップショットからポケモンを取得する"],
          Then: "図鑑番号 999 のポケモンがスナップショットに無いことを示すエラーになる",
        },
      ],
    },
    async () => {
      const client = new SnapshotPokemonClient([record(25, ["electric"])]);
      await expect(client.getPokemonByID(999)).rejects.toThrow(/not found in snapshot/);
    },
  );
});

describe("[共通:機能共通]出題可能な図鑑番号", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "スナップショットに図鑑番号 25、1、4 の順でポケモンがあるとき",
          When: ["出題可能な図鑑番号を取得する"],
          Then: "出題可能な図鑑番号は 1、4、25 の昇順になる",
        },
      ],
    },
    () => {
      const client = new SnapshotPokemonClient([record(25, []), record(1, []), record(4, [])]);
      expect(client.getServableIDs()).toEqual([1, 4, 25]);
    },
  );
});

describe("[共通:機能共通]タイプ別の図鑑番号", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "くさ・どくタイプの 1 番、ほのおタイプの 4 番、でんきタイプの 25 番のポケモンがあるとき",
          When: ["ほのおタイプを指定して図鑑番号を取得する"],
          Then: "図鑑番号の一覧は 4 だけになる",
        },
      ],
    },
    async () => {
      const client = new SnapshotPokemonClient([
        record(1, ["grass", "poison"]),
        record(4, ["fire"]),
        record(25, ["electric"]),
      ]);
      expect(await client.getIDsByType("fire")).toEqual([4]);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["件数・有無"],
      steps: [
        {
          Given: "ほのおタイプのポケモンだけがあるとき",
          When: ["みずタイプを指定して図鑑番号を取得する"],
          Then: "図鑑番号の一覧は空になる",
        },
      ],
    },
    async () => {
      const client = new SnapshotPokemonClient([record(4, ["fire"])]);
      expect(await client.getIDsByType("water")).toEqual([]);
    },
  );
});

describe("[共通:機能共通]スナップショットの読み込み", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "図鑑番号 25 と 1 のポケモンが記録されたスナップショットがあるとき",
          When: ["スナップショットを読み込む"],
          Then: "読み込んだポケモンの図鑑番号は、記録された順に 25、1 になる",
        },
      ],
    },
    async () => {
      const records = await loadPokemonSnapshot(async () =>
        JSON.stringify([record(25, ["electric"]), record(1, ["grass"])]),
      );
      expect(records.map((r) => r.id)).toEqual([25, 1]);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      観点: ["エッジケース"],
      steps: [
        {
          Given: 'スナップショットの内容が一覧ではなく {"id":1} だけのとき',
          When: ["スナップショットを読み込む"],
          Then: "スナップショットの内容が一覧でないことを示すエラーになる",
        },
      ],
    },
    async () => {
      await expect(loadPokemonSnapshot(async () => JSON.stringify({ id: 1 }))).rejects.toThrow(
        /must be a JSON array/,
      );
    },
  );
});
