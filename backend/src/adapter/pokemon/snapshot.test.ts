import { describe, it, expect } from "vitest";
import { SnapshotPokemonClient, loadPokemonSnapshot } from "./snapshot.js";
import type { PokemonRecord } from "../../domain/pokemon.js";
import type { PokemonType } from "../../../../shared/api-types/pokemon.js";

/**
 * テスト用のポケモンレコードを組み立てる。
 * @param id 図鑑番号。
 * @param types タイプ。
 * @returns ポケモンレコード。
 */
function record(id: number, types: PokemonType[]): PokemonRecord {
  return {
    id,
    name_en: `Mon${id}`,
    name_ja: `モン${id}`,
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

describe("スナップショットからのポケモン取得", () => {
  it("図鑑番号を指定すると、その番号のポケモンが返る", async () => {
    const client = new SnapshotPokemonClient([record(9025, ["electric"])]);
    expect((await client.getPokemonByID(9025)).name_ja).toBe("モン9025");
  });

  it("取得したポケモンの画像 URL は、保存値ではなく図鑑番号から組み立てられる", async () => {
    const client = new SnapshotPokemonClient([record(9025, ["electric"])]);
    const url = (await client.getPokemonByID(9025)).sprite_url;
    expect(url).toMatch(/^https:\/\/.+\/9025\.png$/);
  });

  it("スナップショットに無い図鑑番号を指定すると、エラーになる", async () => {
    const client = new SnapshotPokemonClient([record(9025, ["electric"])]);
    await expect(client.getPokemonByID(999)).rejects.toThrow(/not found in snapshot/);
  });
});

describe("出題可能な図鑑番号", () => {
  it("スナップショットに含まれる図鑑番号が昇順で返る", () => {
    const client = new SnapshotPokemonClient([record(9025, []), record(9001, []), record(9004, [])]);
    expect(client.getServableIDs()).toEqual([9001, 9004, 9025]);
  });
});

describe("タイプ別の図鑑番号", () => {
  it("指定したタイプを持つポケモンの図鑑番号だけが返る", async () => {
    const client = new SnapshotPokemonClient([
      record(9001, ["grass", "poison"]),
      record(9004, ["fire"]),
      record(9025, ["electric"]),
    ]);
    expect(await client.getIDsByType("fire")).toEqual([9004]);
  });

  it("該当するポケモンが無いタイプでは空になる", async () => {
    const client = new SnapshotPokemonClient([record(9004, ["fire"])]);
    expect(await client.getIDsByType("water")).toEqual([]);
  });
});

describe("スナップショットの読み込み", () => {
  it("スナップショットを読み込むと、記録されたポケモンが図鑑番号で得られる", async () => {
    const records = await loadPokemonSnapshot(async () => JSON.stringify([record(9025, ["electric"]), record(9001, ["grass"])]));
    expect(records.map((r) => r.id)).toEqual([9025, 9001]);
  });

  it("スナップショットの内容が不正 (配列でない) ならエラーになる", async () => {
    await expect(loadPokemonSnapshot(async () => JSON.stringify({ id: 1 }))).rejects.toThrow(
      /must be a JSON array/,
    );
  });
});
