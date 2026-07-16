import { describe, it, expect } from "vitest";
import {
  cleanFlavorText,
  convertToPokemonRecord,
  type PokeAPISpeciesData,
  type PokeAPIPokemonData,
} from "./convert.js";

/**
 * EN/JA の名前と説明を持つ species データを作る。
 * @param id 図鑑番号。
 * @param nameEN 英名。
 * @param nameJA 和名。
 * @param descEN 英語説明。
 * @param descJA 日本語説明。
 * @returns species データ。
 */
function speciesOf(id: number, nameEN: string, nameJA: string, descEN: string, descJA: string): PokeAPISpeciesData {
  return {
    id,
    is_legendary: false,
    is_mythical: false,
    names: [
      { name: nameEN, language: { name: "en" } },
      { name: nameJA, language: { name: "ja" } },
    ],
    flavor_text_entries: [
      { flavor_text: descEN, language: { name: "en" }, version: { name: "x" } },
      { flavor_text: descJA, language: { name: "ja" }, version: { name: "x" } },
    ],
  };
}

/**
 * 種族値・タイプ・サイズを持つ pokemon データを作る。
 * @param baseStats 各種族値。
 * @param typeNames タイプ名の一覧。
 * @param height 高さ。
 * @param weight 重さ。
 * @returns pokemon データ。
 */
function pokemonOf(baseStats: number[], typeNames: string[], height: number, weight: number): PokeAPIPokemonData {
  return {
    stats: baseStats.map((base_stat) => ({ base_stat })),
    types: typeNames.map((name) => ({ type: { name } })),
    height,
    weight,
  };
}

describe("説明文の整形", () => {
  it("改行や制御文字はスペースに置き換わる", () => {
    expect(cleanFlavorText("A\fB\nC\rD")).toBe("A B C D");
  });

  it("連続する空白は 1 つにまとめられる", () => {
    expect(cleanFlavorText("A   B")).toBe("A B");
  });

  it("前後の空白は取り除かれる", () => {
    expect(cleanFlavorText("  AB  ")).toBe("AB");
  });
});

describe("ポケモンレコードへの変換", () => {
  it.each([
    {
      species: speciesOf(9001, "Testmon", "テストモン", "A test creature.", "テスト用の 生き物。"),
      pokemon: pokemonOf([10, 20, 30], ["fire", "flying"], 5, 50),
      expected: {
        id: 9001, name_en: "Testmon", name_ja: "テストモン",
        description_en: "A test creature.", description_ja: "テスト用の 生き物。",
        base_stat_total: 60, types: ["fire", "flying"], height: 5, weight: 50,
      },
    },
    {
      species: speciesOf(9002, "Duomon", "デュオモン", "Another test creature.", "もう一体の テスト用の 生き物。"),
      pokemon: pokemonOf([15, 25, 15], ["water"], 3, 20),
      expected: {
        id: 9002, name_en: "Duomon", name_ja: "デュオモン",
        description_en: "Another test creature.", description_ja: "もう一体の テスト用の 生き物。",
        base_stat_total: 55, types: ["water"], height: 3, weight: 20,
      },
    },
  ])("$expected.name_ja を変換すると、英名・和名・種族値合計・タイプ・説明が出力される", ({ species, pokemon, expected }) => {
    expect(convertToPokemonRecord(species, pokemon)).toMatchObject(expected);
  });

  it("未知のタイプ名はエラーになる", () => {
    const species = speciesOf(1, "Testmon", "テスト", "en", "ja");
    expect(() => convertToPokemonRecord(species, pokemonOf([1], ["shadow"], 1, 1))).toThrow(
      /unknown pokemon type/,
    );
  });

  it("EN/JA の説明ペアが揃わないとエラーになる", () => {
    const species: PokeAPISpeciesData = {
      ...speciesOf(1, "Testmon", "テスト", "en", "ja"),
      flavor_text_entries: [{ flavor_text: "en only", language: { name: "en" }, version: { name: "x" } }],
    };
    expect(() => convertToPokemonRecord(species, pokemonOf([1], ["fire"], 1, 1))).toThrow(
      /no EN\/JA description pair/,
    );
  });
});
