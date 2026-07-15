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
    const client = new SnapshotPokemonClient([record(25, ["electric"])]);
    expect((await client.getPokemonByID(25)).name_ja).toBe("モン25");
  });

  it("sprite_url は図鑑番号から組み立てた jsDelivr の URL になる (スナップショットに保存しない)", async () => {
    const client = new SnapshotPokemonClient([record(25, ["electric"])]);
    const url = (await client.getPokemonByID(25)).sprite_url;
    expect(url).toContain("cdn.jsdelivr.net");
    expect(url).toContain("/PokeAPI/sprites@");
    expect(url).toMatch(/\/25\.png$/);
  });

  it("スナップショットに無い図鑑番号を指定すると、エラーになる", async () => {
    const client = new SnapshotPokemonClient([record(25, ["electric"])]);
    await expect(client.getPokemonByID(999)).rejects.toThrow(/not found in snapshot/);
  });
});

describe("出題可能な図鑑番号", () => {
  it("スナップショットに含まれる図鑑番号が昇順で返る", () => {
    const client = new SnapshotPokemonClient([record(25, []), record(1, []), record(4, [])]);
    expect(client.getServableIDs()).toEqual([1, 4, 25]);
  });
});

describe("タイプ別の図鑑番号", () => {
  it("指定したタイプを持つポケモンの図鑑番号だけが返る", async () => {
    const client = new SnapshotPokemonClient([
      record(1, ["grass", "poison"]),
      record(4, ["fire"]),
      record(25, ["electric"]),
    ]);
    expect(await client.getIDsByType("fire")).toEqual([4]);
  });

  it("該当するポケモンが無いタイプでは空になる", async () => {
    const client = new SnapshotPokemonClient([record(4, ["fire"])]);
    expect(await client.getIDsByType("water")).toEqual([]);
  });
});

describe("スナップショットの読み込み", () => {
  it("JSON 配列をポケモンレコードとして読み込む", async () => {
    const records = await loadPokemonSnapshot(async () => JSON.stringify([record(25, ["electric"])]));
    expect(records).toHaveLength(1);
    expect(records[0].id).toBe(25);
  });

  it("配列でない JSON はエラーになる", async () => {
    await expect(loadPokemonSnapshot(async () => JSON.stringify({ id: 1 }))).rejects.toThrow(
      /must be a JSON array/,
    );
  });
});
