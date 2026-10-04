import { describe, it, expect } from "vitest";
import {
  cleanFlavorText,
  convertToPokemonRecord,
  type PokeAPISpeciesData,
  type PokeAPIPokemonData,
} from "./convert.js";

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

function pokemonOf(baseStats: number[], typeNames: string[], height: number, weight: number): PokeAPIPokemonData {
  return {
    stats: baseStats.map((base_stat) => ({ base_stat })),
    types: typeNames.map((name) => ({ type: { name } })),
    height,
    weight,
    // 変換では技を参照しないため、空配列にする
    moves: [],
  };
}

describe("[ポケモンデータ] 説明文の整形", () => {
  describe("正常系", () => {
    it.each([
      ["改ページ", "A\fB"],
      ["改行", "A\nB"],
      ["復帰", "A\rB"],
    ])("説明文に%sが含まれるとき、整形した説明文ではスペース 1 つに置き換わる", (_label, text) => {
      expect(cleanFlavorText(text)).toBe("A B");
    });

    it("説明文に連続するスペースがあるとき、整形した説明文では 1 つのスペースにまとまる", () => {
      expect(cleanFlavorText("A   B")).toBe("A B");
    });

    it("説明文の前後にスペースがあるとき、整形した説明文では取り除かれる", () => {
      expect(cleanFlavorText("  AB  ")).toBe("AB");
    });
  });
});

interface ConversionCase {
  label: string;
  species: PokeAPISpeciesData;
  pokemon: PokeAPIPokemonData;
  levelUpMoves: string[];
  typesDisplay: string;
  levelUpMovesDisplay: string;
  expected: {
    id: number;
    name_en: string;
    name_ja: string;
    description_en: string;
    description_ja: string;
    base_stat_total: number;
    types: string[];
    height: number;
    weight: number;
    level_up_moves: string[];
    flavor_texts: { version_names: string[]; description_en: string; description_ja: string }[];
  };
}

const CONVERSION_CASES: ConversionCase[] = [
  {
    label: "フシギダネ",
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
    levelUpMoves: ["たいあたり", "なきごえ", "つるのムチ"],
    typesDisplay: "くさ・どく の 2 つ",
    levelUpMovesDisplay: "たいあたり・なきごえ・つるのムチ",
    expected: {
      id: 1, name_en: "Bulbasaur", name_ja: "フシギダネ",
      description_en: "A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokémon.",
      description_ja: "生まれたときから　背中に 不思議な　タネが　植えてあって 体と　ともに　育つという。",
      base_stat_total: 318, types: ["grass", "poison"], height: 7, weight: 69,
      level_up_moves: ["たいあたり", "なきごえ", "つるのムチ"],
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
    label: "ヒトカゲ",
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
    levelUpMoves: ["ひっかく", "なきごえ", "ひのこ"],
    typesDisplay: "ほのお の 1 つ",
    levelUpMovesDisplay: "ひっかく・なきごえ・ひのこ",
    expected: {
      id: 4, name_en: "Charmander", name_ja: "ヒトカゲ",
      description_en: "The flame on its tail indicates Charmander’s life force. If it is healthy, the flame burns brightly.",
      description_ja: "尻尾の　炎は ヒトカゲの　生命力の　証。 元気だと　さかんに　燃えさかる。",
      base_stat_total: 309, types: ["fire"], height: 6, weight: 85,
      level_up_moves: ["ひっかく", "なきごえ", "ひのこ"],
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
];

function convertCase(c: ConversionCase) {
  return convertToPokemonRecord(c.species, c.pokemon, c.levelUpMoves);
}

describe("[ポケモンデータ] スナップショット用データへの変換", () => {
  describe("正常系", () => {
    it.each(CONVERSION_CASES.map((c) => [c.label, c.expected.id, c] as const))(
      "%sのとき、変換後の図鑑番号は %s になる",
      (_label, _display, c) => {
        expect(convertCase(c).id).toBe(c.expected.id);
      },
    );

    it.each(CONVERSION_CASES.map((c) => [c.label, c.expected.name_en, c] as const))(
      "%sのとき、変換後の英名は %s になる",
      (_label, _display, c) => {
        expect(convertCase(c).name_en).toBe(c.expected.name_en);
      },
    );

    it.each(CONVERSION_CASES.map((c) => [c.label, c.expected.name_ja, c] as const))(
      "%sのとき、変換後の和名は%sになる",
      (_label, _display, c) => {
        expect(convertCase(c).name_ja).toBe(c.expected.name_ja);
      },
    );

    it.each(CONVERSION_CASES.map((c) => [c.label, c.expected.base_stat_total, c] as const))(
      "%sのとき、変換後の種族値の合計は %s になる",
      (_label, _display, c) => {
        expect(convertCase(c).base_stat_total).toBe(c.expected.base_stat_total);
      },
    );

    it.each(CONVERSION_CASES.map((c) => [c.label, c.typesDisplay, c] as const))(
      "%sのとき、変換後のタイプは %sになる",
      (_label, _display, c) => {
        expect(convertCase(c).types).toEqual(c.expected.types);
      },
    );

    it.each(CONVERSION_CASES.map((c) => [c.label, c.expected.height, c] as const))(
      "%sのとき、変換後の高さは %s になる",
      (_label, _display, c) => {
        expect(convertCase(c).height).toBe(c.expected.height);
      },
    );

    it.each(CONVERSION_CASES.map((c) => [c.label, c.expected.weight, c] as const))(
      "%sのとき、変換後の重さは %s になる",
      (_label, _display, c) => {
        expect(convertCase(c).weight).toBe(c.expected.weight);
      },
    );

    it.each(CONVERSION_CASES.map((c) => [c.label, c] as const))(
      "%sのとき、変換後の英語の説明文は、図鑑の表示順で最初の X バージョンの英語の説明文を整形した文になる",
      (_label, c) => {
        expect(convertCase(c).description_en).toBe(c.expected.description_en);
      },
    );

    it.each(CONVERSION_CASES.map((c) => [c.label, c] as const))(
      "%sのとき、変換後の日本語の説明文は、図鑑の表示順で最初の X バージョンの日本語の説明文を整形した文になる",
      (_label, c) => {
        expect(convertCase(c).description_ja).toBe(c.expected.description_ja);
      },
    );

    it.each(CONVERSION_CASES.map((c) => [c.label, c] as const))(
      "%sのとき、変換後のバージョン別の説明文の一覧は、X・Y の順に、整形した英語と日本語の説明文のペアになる",
      (_label, c) => {
        expect(convertCase(c).flavor_texts).toEqual(c.expected.flavor_texts);
      },
    );

    it.each(CONVERSION_CASES.map((c) => [c.label, c.levelUpMovesDisplay, c] as const))(
      "%sのとき、変換後のレベルアップで覚える技の一覧は、指定した %s になる",
      (_label, _display, c) => {
        expect(convertCase(c).level_up_moves).toEqual(c.expected.level_up_moves);
      },
    );
  });

  describe("異常系", () => {
    it("タイプ名が未知の shadow のとき、変換すると未知のタイプというエラーになる", () => {
      const species = speciesOf(1, "Bulbasaur", "フシギダネ", [{ version: "x", en: "en", ja: "ja" }]);
      expect(() => convertToPokemonRecord(species, pokemonOf([1], ["shadow"], 1, 1), ["たいあたり"])).toThrow(
        /unknown pokemon type/,
      );
    });

    it("英語の説明文だけがあり日本語の説明文が無いとき、変換すると英語と日本語の説明文のペアが無いというエラーになる", () => {
      const species: PokeAPISpeciesData = {
        ...speciesOf(1, "Bulbasaur", "フシギダネ", [{ version: "x", en: "en", ja: "ja" }]),
        flavor_text_entries: [{ flavor_text: "en only", language: { name: "en" }, version: { name: "x" } }],
      };
      expect(() => convertToPokemonRecord(species, pokemonOf([1], ["fire"], 1, 1), ["たいあたり"])).toThrow(
        /no EN\/JA description pair/,
      );
    });
  });
});
