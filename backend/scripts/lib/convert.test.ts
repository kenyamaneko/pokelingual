import { describe, expect } from "vitest";
import {
  cleanFlavorText,
  convertToPokemonRecord,
  type PokeAPISpeciesData,
  type PokeAPIPokemonData,
} from "./convert.js";
import { defineCase, type Viewpoint } from "../../src/test/defineCase.js";

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

const BULBASAUR_SPECIES = speciesOf(1, "Bulbasaur", "フシギダネ", [
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
]);
const BULBASAUR_POKEMON = pokemonOf([45, 49, 49, 65, 65, 45], ["grass", "poison"], 7, 69);
const BULBASAUR_LEVEL_UP_MOVES = ["たいあたり", "なきごえ", "つるのムチ"];

const CHARMANDER_SPECIES = speciesOf(4, "Charmander", "ヒトカゲ", [
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
]);
const CHARMANDER_POKEMON = pokemonOf([39, 52, 43, 60, 50, 65], ["fire"], 6, 85);
const CHARMANDER_LEVEL_UP_MOVES = ["ひっかく", "なきごえ", "ひのこ"];

function convertBulbasaur() {
  return convertToPokemonRecord(BULBASAUR_SPECIES, BULBASAUR_POKEMON, BULBASAUR_LEVEL_UP_MOVES);
}

function convertCharmander() {
  return convertToPokemonRecord(CHARMANDER_SPECIES, CHARMANDER_POKEMON, CHARMANDER_LEVEL_UP_MOVES);
}

const CLEAN_FLAVOR_TEXT = "PokeAPI の説明文を整形する";
const CREATE_POKEMON_RECORD = "PokeAPI の元データからポケモンデータを作成する";
const FLAVOR_TEXT_PAIR_COUNT = "作成したポケモンデータの説明文ペアの一覧は 2 組になる";
const BULBASAUR_FLAVOR_TEXTS_GIVEN =
  "フシギダネのバージョン X の説明文が英語「A strange seed was planted on its back at birth.⏎The plant sprouts and grows with this Pokémon.」・日本語「生まれたときから　背中に⏎不思議な　タネが　植えてあって⏎体と　ともに　育つという。」、バージョン Y の説明文が英語「For some time after its birth, it grows by gaining⏎nourishment from the seed on its back.」・日本語「生まれてから　しばらくの　あいだは⏎背中の　タネから　栄養を　もらって⏎大きく　育つ。」のとき";
const CHARMANDER_FLAVOR_TEXTS_GIVEN =
  "ヒトカゲのバージョン X の説明文が英語「The flame on its tail indicates Charmander’s life⏎force. If it is healthy, the flame burns brightly.」・日本語「尻尾の　炎は⏎ヒトカゲの　生命力の　証。⏎元気だと　さかんに　燃えさかる。」、バージョン Y の説明文が英語「From the time it is born, a flame burns at the tip of⏎its tail. Its life would end if the flame were to⏎go out.」・日本語「生まれたときから　尻尾に　炎が⏎点っている。炎が　消えたとき⏎その　命は　終わってしまう。」のとき";

describe("[外部連携:ポケモンデータ提供元]説明文の整形", () => {
  const WHITESPACE_CASES: { given: string; text: string; 観点: readonly Viewpoint[] }[] = [
    { given: "「A」と「B」の間に改ページがある", text: "A\fB", 観点: ["同値分割"] },
    { given: "「A」と「B」の間に改行がある", text: "A\nB", 観点: ["同値分割"] },
    { given: "「A」と「B」の間に復帰がある", text: "A\rB", 観点: ["同値分割"] },
    { given: "「A」と「B」の間にスペースが 3 つ連続している", text: "A   B", 観点: [] },
  ];

  for (const { given, text, 観点 } of WHITESPACE_CASES) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        観点,
        steps: [{ Given: `${given}とき`, When: [CLEAN_FLAVOR_TEXT], Then: "整形後の説明文は「A B」になる" }],
      },
      () => {
        expect(cleanFlavorText(text)).toBe("A B");
      },
    );
  }

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: "説明文「AB」の前後にスペースが 2 つずつあるとき", When: [CLEAN_FLAVOR_TEXT], Then: "整形後の説明文は「AB」になる" }],
    },
    () => {
      expect(cleanFlavorText("  AB  ")).toBe("AB");
    },
  );
});

describe("[外部連携:ポケモンデータ提供元]スナップショット用ポケモンデータの作成", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: "フシギダネの元データの図鑑番号が 1 のとき", When: [CREATE_POKEMON_RECORD], Then: "作成したポケモンデータの図鑑番号は 1 になる" }],
    },
    () => {
      expect(convertBulbasaur().id).toBe(1);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: "ヒトカゲの元データの図鑑番号が 4 のとき", When: [CREATE_POKEMON_RECORD], Then: "作成したポケモンデータの図鑑番号は 4 になる" }],
    },
    () => {
      expect(convertCharmander().id).toBe(4);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: "フシギダネの元データの英語名が Bulbasaur のとき", When: [CREATE_POKEMON_RECORD], Then: "作成したポケモンデータの英語名は Bulbasaur になる" }],
    },
    () => {
      expect(convertBulbasaur().name_en).toBe("Bulbasaur");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: "ヒトカゲの元データの英語名が Charmander のとき", When: [CREATE_POKEMON_RECORD], Then: "作成したポケモンデータの英語名は Charmander になる" }],
    },
    () => {
      expect(convertCharmander().name_en).toBe("Charmander");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: "フシギダネの元データの日本語名がフシギダネのとき", When: [CREATE_POKEMON_RECORD], Then: "作成したポケモンデータの日本語名はフシギダネになる" }],
    },
    () => {
      expect(convertBulbasaur().name_ja).toBe("フシギダネ");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: "ヒトカゲの元データの日本語名がヒトカゲのとき", When: [CREATE_POKEMON_RECORD], Then: "作成したポケモンデータの日本語名はヒトカゲになる" }],
    },
    () => {
      expect(convertCharmander().name_ja).toBe("ヒトカゲ");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: "種族値が 45・49・49・65・65・45 のとき", When: [CREATE_POKEMON_RECORD], Then: "作成したポケモンデータの種族値の合計は 318 になる" }],
    },
    () => {
      expect(convertBulbasaur().base_stat_total).toBe(318);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: "種族値が 39・52・43・60・50・65 のとき", When: [CREATE_POKEMON_RECORD], Then: "作成したポケモンデータの種族値の合計は 309 になる" }],
    },
    () => {
      expect(convertCharmander().base_stat_total).toBe(309);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["件数・有無"],
      steps: [{ Given: "タイプが grass と poison のとき", When: [CREATE_POKEMON_RECORD], Then: "作成したポケモンデータのタイプは grass と poison の 2 つになる" }],
    },
    () => {
      expect(convertBulbasaur().types).toEqual(["grass", "poison"]);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["件数・有無"],
      steps: [{ Given: "タイプが fire のとき", When: [CREATE_POKEMON_RECORD], Then: "作成したポケモンデータのタイプは fire の 1 つになる" }],
    },
    () => {
      expect(convertCharmander().types).toEqual(["fire"]);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: "フシギダネの元データの高さが 7 のとき", When: [CREATE_POKEMON_RECORD], Then: "作成したポケモンデータの高さは 7 になる" }],
    },
    () => {
      expect(convertBulbasaur().height).toBe(7);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: "ヒトカゲの元データの高さが 6 のとき", When: [CREATE_POKEMON_RECORD], Then: "作成したポケモンデータの高さは 6 になる" }],
    },
    () => {
      expect(convertCharmander().height).toBe(6);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: "フシギダネの元データの重さが 69 のとき", When: [CREATE_POKEMON_RECORD], Then: "作成したポケモンデータの重さは 69 になる" }],
    },
    () => {
      expect(convertBulbasaur().weight).toBe(69);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: "ヒトカゲの元データの重さが 85 のとき", When: [CREATE_POKEMON_RECORD], Then: "作成したポケモンデータの重さは 85 になる" }],
    },
    () => {
      expect(convertCharmander().weight).toBe(85);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: "フシギダネがレベルアップで覚える技の日本語名が、たいあたり・なきごえ・つるのムチであるとき", When: [CREATE_POKEMON_RECORD], Then: "作成したポケモンデータのレベルアップで覚える技は、たいあたり・なきごえ・つるのムチの順になる" }],
    },
    () => {
      expect(convertBulbasaur().level_up_moves).toEqual(["たいあたり", "なきごえ", "つるのムチ"]);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: "ヒトカゲがレベルアップで覚える技の日本語名が、ひっかく・なきごえ・ひのこであるとき", When: [CREATE_POKEMON_RECORD], Then: "作成したポケモンデータのレベルアップで覚える技は、ひっかく・なきごえ・ひのこの順になる" }],
    },
    () => {
      expect(convertCharmander().level_up_moves).toEqual(["ひっかく", "なきごえ", "ひのこ"]);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      観点: ["外部依存の失敗"],
      steps: [{ Given: "タイプ名が未知の shadow のとき", When: [CREATE_POKEMON_RECORD], Then: "未知のタイプであることを示すエラーになる" }],
    },
    () => {
      const species = speciesOf(1, "Bulbasaur", "フシギダネ", [{ version: "x", en: "en", ja: "ja" }]);
      expect(() => convertToPokemonRecord(species, pokemonOf([1], ["shadow"], 1, 1), ["たいあたり"])).toThrow(
        /unknown pokemon type/,
      );
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      観点: ["外部依存の失敗"],
      steps: [
        {
          Given: "英語の説明文だけがあり日本語の説明文が無いとき",
          When: [CREATE_POKEMON_RECORD],
          Then: "英語と日本語の説明文ペアが無いことを示すエラーになる",
        },
      ],
    },
    () => {
      const species: PokeAPISpeciesData = {
        ...speciesOf(1, "Bulbasaur", "フシギダネ", [{ version: "x", en: "en", ja: "ja" }]),
        flavor_text_entries: [{ flavor_text: "en only", language: { name: "en" }, version: { name: "x" } }],
      };
      expect(() => convertToPokemonRecord(species, pokemonOf([1], ["fire"], 1, 1), ["たいあたり"])).toThrow(
        /no EN\/JA description pair/,
      );
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: "フシギダネのバージョン X の英語の説明文が「A strange seed was planted on its back at birth.⏎The plant sprouts and grows with this Pokémon.」のとき", When: [CREATE_POKEMON_RECORD], Then: "作成したポケモンデータの英語の説明文は「A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokémon.」になる" }],
    },
    () => {
      expect(convertBulbasaur().description_en).toBe(
      "A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokémon.",
    );
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: "ヒトカゲのバージョン X の英語の説明文が「The flame on its tail indicates Charmander’s life⏎force. If it is healthy, the flame burns brightly.」のとき", When: [CREATE_POKEMON_RECORD], Then: "作成したポケモンデータの英語の説明文は「The flame on its tail indicates Charmander’s life force. If it is healthy, the flame burns brightly.」になる" }],
    },
    () => {
      expect(convertCharmander().description_en).toBe(
      "The flame on its tail indicates Charmander’s life force. If it is healthy, the flame burns brightly.",
    );
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: "フシギダネのバージョン X の日本語の説明文が「生まれたときから　背中に⏎不思議な　タネが　植えてあって⏎体と　ともに　育つという。」のとき", When: [CREATE_POKEMON_RECORD], Then: "作成したポケモンデータの日本語の説明文は「生まれたときから　背中に 不思議な　タネが　植えてあって 体と　ともに　育つという。」になる" }],
    },
    () => {
      expect(convertBulbasaur().description_ja).toBe(
      "生まれたときから　背中に 不思議な　タネが　植えてあって 体と　ともに　育つという。",
    );
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: "ヒトカゲのバージョン X の日本語の説明文が「尻尾の　炎は⏎ヒトカゲの　生命力の　証。⏎元気だと　さかんに　燃えさかる。」のとき", When: [CREATE_POKEMON_RECORD], Then: "作成したポケモンデータの日本語の説明文は「尻尾の　炎は ヒトカゲの　生命力の　証。 元気だと　さかんに　燃えさかる。」になる" }],
    },
    () => {
      expect(convertCharmander().description_ja).toBe(
      "尻尾の　炎は ヒトカゲの　生命力の　証。 元気だと　さかんに　燃えさかる。",
    );
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["件数・有無"],
      steps: [{ Given: BULBASAUR_FLAVOR_TEXTS_GIVEN, When: [CREATE_POKEMON_RECORD], Then: FLAVOR_TEXT_PAIR_COUNT }],
    },
    () => {
      expect(convertBulbasaur().flavor_texts).toHaveLength(2);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: BULBASAUR_FLAVOR_TEXTS_GIVEN,
          When: [CREATE_POKEMON_RECORD],
          Then: "作成したポケモンデータの説明文ペアの一覧の 1 組目は、バージョン名 X・英語「A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokémon.」・日本語「生まれたときから　背中に 不思議な　タネが　植えてあって 体と　ともに　育つという。」になる",
        },
      ],
    },
    () => {
      expect(convertBulbasaur().flavor_texts?.[0]).toEqual({
        version_names: ["X"],
        description_en: "A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokémon.",
        description_ja: "生まれたときから　背中に 不思議な　タネが　植えてあって 体と　ともに　育つという。",
      });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: BULBASAUR_FLAVOR_TEXTS_GIVEN,
          When: [CREATE_POKEMON_RECORD],
          Then: "作成したポケモンデータの説明文ペアの一覧の 2 組目は、バージョン名 Y・英語「For some time after its birth, it grows by gaining nourishment from the seed on its back.」・日本語「生まれてから　しばらくの　あいだは 背中の　タネから　栄養を　もらって 大きく　育つ。」になる",
        },
      ],
    },
    () => {
      expect(convertBulbasaur().flavor_texts?.[1]).toEqual({
        version_names: ["Y"],
        description_en: "For some time after its birth, it grows by gaining nourishment from the seed on its back.",
        description_ja: "生まれてから　しばらくの　あいだは 背中の　タネから　栄養を　もらって 大きく　育つ。",
      });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["件数・有無"],
      steps: [{ Given: CHARMANDER_FLAVOR_TEXTS_GIVEN, When: [CREATE_POKEMON_RECORD], Then: FLAVOR_TEXT_PAIR_COUNT }],
    },
    () => {
      expect(convertCharmander().flavor_texts).toHaveLength(2);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: CHARMANDER_FLAVOR_TEXTS_GIVEN,
          When: [CREATE_POKEMON_RECORD],
          Then: "作成したポケモンデータの説明文ペアの一覧の 1 組目は、バージョン名 X・英語「The flame on its tail indicates Charmander’s life force. If it is healthy, the flame burns brightly.」・日本語「尻尾の　炎は ヒトカゲの　生命力の　証。 元気だと　さかんに　燃えさかる。」になる",
        },
      ],
    },
    () => {
      expect(convertCharmander().flavor_texts?.[0]).toEqual({
        version_names: ["X"],
        description_en: "The flame on its tail indicates Charmander’s life force. If it is healthy, the flame burns brightly.",
        description_ja: "尻尾の　炎は ヒトカゲの　生命力の　証。 元気だと　さかんに　燃えさかる。",
      });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: CHARMANDER_FLAVOR_TEXTS_GIVEN,
          When: [CREATE_POKEMON_RECORD],
          Then: "作成したポケモンデータの説明文ペアの一覧の 2 組目は、バージョン名 Y・英語「From the time it is born, a flame burns at the tip of its tail. Its life would end if the flame were to go out.」・日本語「生まれたときから　尻尾に　炎が 点っている。炎が　消えたとき その　命は　終わってしまう。」になる",
        },
      ],
    },
    () => {
      expect(convertCharmander().flavor_texts?.[1]).toEqual({
        version_names: ["Y"],
        description_en: "From the time it is born, a flame burns at the tip of its tail. Its life would end if the flame were to go out.",
        description_ja: "生まれたときから　尻尾に　炎が 点っている。炎が　消えたとき その　命は　終わってしまう。",
      });
    },
  );
});
