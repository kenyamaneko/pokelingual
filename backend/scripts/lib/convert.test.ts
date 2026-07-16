import { describe, it, expect } from "vitest";
import {
  cleanFlavorText,
  convertToPokemonRecord,
  type PokeAPISpeciesData,
  type PokeAPIPokemonData,
} from "./convert.js";

/**
 * EN/JA の名前とバージョン別の説明を持つ species データを作る。
 * @param id 図鑑番号。
 * @param nameEN 英名。
 * @param nameJA 和名。
 * @param flavorTexts バージョンごとの EN/JA 説明。
 * @returns species データ。
 */
function speciesOf(
  id: number,
  nameEN: string,
  nameJA: string,
  flavorTexts: { version: string; en: string; ja: string }[],
): PokeAPISpeciesData {
  return {
    id,
    is_legendary: false,
    is_mythical: false,
    names: [
      { name: nameEN, language: { name: "en" } },
      { name: nameJA, language: { name: "ja" } },
    ],
    flavor_text_entries: flavorTexts.flatMap(({ version, en, ja }) => [
      { flavor_text: en, language: { name: "en" }, version: { name: version } },
      { flavor_text: ja, language: { name: "ja" }, version: { name: version } },
    ]),
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
      species: speciesOf(1, "Bulbasaur", "フシギダネ", [
        {
          version: "x",
          en: "A strange seed was planted on its back at birth.\nThe plant sprouts and grows with this Pokémon.",
          ja: "生まれたときから　背中に\n不思議な　タネが　植えてあって\n体と　ともに　育つという。",
        },
        {
          version: "y",
          en: "For some time after its birth, it grows by gaining\nnourishment from the seed on its back.",
          ja: "生まれてから　しばらくの　あいだは\n背中の　タネから　栄養を　もらって\n大きく　育つ。",
        },
      ]),
      pokemon: pokemonOf([45, 49, 49, 65, 65, 45], ["grass", "poison"], 7, 69),
      expected: {
        id: 1, name_en: "Bulbasaur", name_ja: "フシギダネ",
        description_en: "A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokémon.",
        description_ja: "生まれたときから　背中に 不思議な　タネが　植えてあって 体と　ともに　育つという。",
        base_stat_total: 318, types: ["grass", "poison"], height: 7, weight: 69,
        flavor_texts: [
          {
            version_names: ["X"],
            description_en: "A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokémon.",
            description_ja: "生まれたときから　背中に 不思議な　タネが　植えてあって 体と　ともに　育つという。",
          },
          {
            version_names: ["Y"],
            description_en: "For some time after its birth, it grows by gaining nourishment from the seed on its back.",
            description_ja: "生まれてから　しばらくの　あいだは 背中の　タネから　栄養を　もらって 大きく　育つ。",
          },
        ],
      },
    },
    {
      species: speciesOf(4, "Charmander", "ヒトカゲ", [
        {
          version: "x",
          en: "The flame on its tail indicates Charmander’s life\nforce. If it is healthy, the flame burns brightly.",
          ja: "尻尾の　炎は\nヒトカゲの　生命力の　証。\n元気だと　さかんに　燃えさかる。",
        },
        {
          version: "y",
          en: "From the time it is born, a flame burns at the tip of\nits tail. Its life would end if the flame were to\ngo out.",
          ja: "生まれたときから　尻尾に　炎が\n点っている。炎が　消えたとき\nその　命は　終わってしまう。",
        },
      ]),
      pokemon: pokemonOf([39, 52, 43, 60, 50, 65], ["fire"], 6, 85),
      expected: {
        id: 4, name_en: "Charmander", name_ja: "ヒトカゲ",
        description_en: "The flame on its tail indicates Charmander’s life force. If it is healthy, the flame burns brightly.",
        description_ja: "尻尾の　炎は ヒトカゲの　生命力の　証。 元気だと　さかんに　燃えさかる。",
        base_stat_total: 309, types: ["fire"], height: 6, weight: 85,
        flavor_texts: [
          {
            version_names: ["X"],
            description_en: "The flame on its tail indicates Charmander’s life force. If it is healthy, the flame burns brightly.",
            description_ja: "尻尾の　炎は ヒトカゲの　生命力の　証。 元気だと　さかんに　燃えさかる。",
          },
          {
            version_names: ["Y"],
            description_en: "From the time it is born, a flame burns at the tip of its tail. Its life would end if the flame were to go out.",
            description_ja: "生まれたときから　尻尾に　炎が 点っている。炎が　消えたとき その　命は　終わってしまう。",
          },
        ],
      },
    },
  ])("$expected.name_ja を変換すると、英名・和名・種族値合計・タイプ・説明・バージョン別説明一覧が出力される", ({ species, pokemon, expected }) => {
    expect(convertToPokemonRecord(species, pokemon)).toMatchObject(expected);
  });

  it("未知のタイプ名はエラーになる", () => {
    const species = speciesOf(1, "Testmon", "テスト", [{ version: "x", en: "en", ja: "ja" }]);
    expect(() => convertToPokemonRecord(species, pokemonOf([1], ["shadow"], 1, 1))).toThrow(
      /unknown pokemon type/,
    );
  });

  it("EN/JA の説明ペアが揃わないとエラーになる", () => {
    const species: PokeAPISpeciesData = {
      ...speciesOf(1, "Testmon", "テスト", [{ version: "x", en: "en", ja: "ja" }]),
      flavor_text_entries: [{ flavor_text: "en only", language: { name: "en" }, version: { name: "x" } }],
    };
    expect(() => convertToPokemonRecord(species, pokemonOf([1], ["fire"], 1, 1))).toThrow(
      /no EN\/JA description pair/,
    );
  });
});
