import { describe, it, expect } from "vitest";
import {
  cleanFlavorText,
  convertToPokemonRecord,
  type PokeAPISpeciesData,
  type PokeAPIPokemonData,
} from "./convert.js";

/**
 * EN/JA の名前と説明が揃った species データを作る。
 * @param overrides 上書きするフィールド。
 * @returns species データ。
 */
function makeSpecies(overrides: Partial<PokeAPISpeciesData> = {}): PokeAPISpeciesData {
  return {
    id: 1,
    is_legendary: false,
    is_mythical: false,
    names: [
      { name: "Testmon", language: { name: "en" } },
      { name: "テストモン", language: { name: "ja" } },
    ],
    flavor_text_entries: [
      { flavor_text: "Fast.", language: { name: "en" }, version: { name: "x" } },
      { flavor_text: "はやい。", language: { name: "ja" }, version: { name: "x" } },
    ],
    ...overrides,
  };
}

/**
 * 指定タイプの pokemon データを作る。
 * @param typeNames タイプ名の一覧。
 * @returns pokemon データ。
 */
function makePokemon(typeNames: string[]): PokeAPIPokemonData {
  return {
    stats: [{ base_stat: 100 }, { base_stat: 50 }],
    types: typeNames.map((name) => ({ type: { name } })),
    height: 4,
    weight: 60,
  };
}

describe("説明文の整形", () => {
  it("改行・改ページ・復帰をスペースに置換する", () => {
    expect(cleanFlavorText("A\fB\nC\rD")).toBe("A B C D");
  });

  it("連続スペースを 1 つに畳み、前後をトリムする", () => {
    expect(cleanFlavorText("  A   B  ")).toBe("A B");
  });
});

describe("ポケモンレコードへの変換", () => {
  it("EN/JA の説明ペアが揃うと、名前・種族値合計・説明がレコードに変換される", () => {
    const record = convertToPokemonRecord(makeSpecies(), makePokemon(["electric"]));
    expect(record).toMatchObject({
      id: 1,
      name_en: "Testmon",
      name_ja: "テストモン",
      description_en: "Fast.",
      description_ja: "はやい。",
      base_stat_total: 150,
    });
  });

  it("既知のタイプ名は、レコードのタイプとして採用される", () => {
    const record = convertToPokemonRecord(makeSpecies(), makePokemon(["grass", "poison"]));
    expect(record.types).toEqual(["grass", "poison"]);
  });

  it("未知のタイプ名はエラーになる", () => {
    expect(() => convertToPokemonRecord(makeSpecies(), makePokemon(["shadow"]))).toThrow(
      /unknown pokemon type/,
    );
  });

  it("EN/JA の説明ペアが無いとエラーになる (生成時に欠損を検出する)", () => {
    const species = makeSpecies({
      flavor_text_entries: [{ flavor_text: "Fast.", language: { name: "en" }, version: { name: "x" } }],
    });
    expect(() => convertToPokemonRecord(species, makePokemon(["electric"]))).toThrow(
      /no EN\/JA description pair/,
    );
  });
});
