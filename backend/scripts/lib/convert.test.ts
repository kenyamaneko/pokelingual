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
      species: speciesOf(1, "Bulbasaur", "フシギダネ", "A strange seed.", "不思議な タネ。"),
      pokemon: pokemonOf([45, 49, 49], ["grass", "poison"], 7, 69),
      expected: {
        id: 1, name_en: "Bulbasaur", name_ja: "フシギダネ",
        description_en: "A strange seed.", description_ja: "不思議な タネ。",
        base_stat_total: 143, types: ["grass", "poison"], height: 7, weight: 69,
      },
    },
    {
      species: speciesOf(4, "Charmander", "ヒトカゲ", "It likes hot places.", "暑い ところが 好き。"),
      pokemon: pokemonOf([39, 52, 43], ["fire"], 6, 85),
      expected: {
        id: 4, name_en: "Charmander", name_ja: "ヒトカゲ",
        description_en: "It likes hot places.", description_ja: "暑い ところが 好き。",
        base_stat_total: 134, types: ["fire"], height: 6, weight: 85,
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
