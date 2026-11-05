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

describe("[外部連携:ポケモンデータ:スナップショット生成]説明文の整形", () => {
  describe("単体テスト", () => {
    describe("正常系", () => {
      it.each([
        ["「A」と「B」の間に改ページがある", "A\fB"],
        ["「A」と「B」の間に改行がある", "A\nB"],
        ["「A」と「B」の間に復帰がある", "A\rB"],
        ["「A」と「B」の間にスペースが 3 つ連続している", "A   B"],
      ])("%sとき、整形後の説明文は「A B」になる", (_given, text) => {
        expect(cleanFlavorText(text)).toBe("A B");
      });

      it("説明文「AB」の前後にスペースが 2 つずつあるとき、整形後の説明文は「AB」になる", () => {
        expect(cleanFlavorText("  AB  ")).toBe("AB");
      });
    });
  });
});

describe("[外部連携:ポケモンデータ:スナップショット生成]スナップショット用ポケモンデータの作成", () => {
  describe("単体テスト", () => {
    describe("正常系", () => {
      it("フシギダネの元データの図鑑番号が 1 のとき、作成したポケモンデータの図鑑番号は 1 になる", () => {
        expect(convertBulbasaur().id).toBe(1);
      });

      it("ヒトカゲの元データの図鑑番号が 4 のとき、作成したポケモンデータの図鑑番号は 4 になる", () => {
        expect(convertCharmander().id).toBe(4);
      });

      it("フシギダネの元データの英語名が Bulbasaur のとき、作成したポケモンデータの英語名は Bulbasaur になる", () => {
        expect(convertBulbasaur().name_en).toBe("Bulbasaur");
      });

      it("ヒトカゲの元データの英語名が Charmander のとき、作成したポケモンデータの英語名は Charmander になる", () => {
        expect(convertCharmander().name_en).toBe("Charmander");
      });

      it("フシギダネの元データの日本語名がフシギダネのとき、作成したポケモンデータの日本語名はフシギダネになる", () => {
        expect(convertBulbasaur().name_ja).toBe("フシギダネ");
      });

      it("ヒトカゲの元データの日本語名がヒトカゲのとき、作成したポケモンデータの日本語名はヒトカゲになる", () => {
        expect(convertCharmander().name_ja).toBe("ヒトカゲ");
      });

      it("種族値が 45・49・49・65・65・45 のとき、作成したポケモンデータの種族値の合計は 318 になる", () => {
        expect(convertBulbasaur().base_stat_total).toBe(318);
      });

      it("種族値が 39・52・43・60・50・65 のとき、作成したポケモンデータの種族値の合計は 309 になる", () => {
        expect(convertCharmander().base_stat_total).toBe(309);
      });

      it("タイプが grass と poison (くさ・どく) のとき、作成したポケモンデータのタイプは grass と poison の 2 つになる", () => {
        expect(convertBulbasaur().types).toEqual(["grass", "poison"]);
      });

      it("タイプが fire (ほのお) のとき、作成したポケモンデータのタイプは fire の 1 つになる", () => {
        expect(convertCharmander().types).toEqual(["fire"]);
      });

      it("フシギダネの元データの高さが 7 のとき、作成したポケモンデータの高さは 7 になる", () => {
        expect(convertBulbasaur().height).toBe(7);
      });

      it("ヒトカゲの元データの高さが 6 のとき、作成したポケモンデータの高さは 6 になる", () => {
        expect(convertCharmander().height).toBe(6);
      });

      it("フシギダネの元データの重さが 69 のとき、作成したポケモンデータの重さは 69 になる", () => {
        expect(convertBulbasaur().weight).toBe(69);
      });

      it("ヒトカゲの元データの重さが 85 のとき、作成したポケモンデータの重さは 85 になる", () => {
        expect(convertCharmander().weight).toBe(85);
      });

      it("レベルアップで覚える技の日本語名としてたいあたり・なきごえ・つるのムチが渡されたとき、作成したポケモンデータのレベルアップで覚える技は、たいあたり・なきごえ・つるのムチの順になる", () => {
        expect(convertBulbasaur().level_up_moves).toEqual(["たいあたり", "なきごえ", "つるのムチ"]);
      });

      it("レベルアップで覚える技の日本語名としてひっかく・なきごえ・ひのこが渡されたとき、作成したポケモンデータのレベルアップで覚える技は、ひっかく・なきごえ・ひのこの順になる", () => {
        expect(convertCharmander().level_up_moves).toEqual(["ひっかく", "なきごえ", "ひのこ"]);
      });
    });

    describe("異常系", () => {
      it("タイプ名が未知の shadow のとき、作成すると、未知のタイプであることを示すエラーになる", () => {
        const species = speciesOf(1, "Bulbasaur", "フシギダネ", [{ version: "x", en: "en", ja: "ja" }]);
        expect(() => convertToPokemonRecord(species, pokemonOf([1], ["shadow"], 1, 1), ["たいあたり"])).toThrow(
          /unknown pokemon type/,
        );
      });

      it("英語の説明文だけがあり日本語の説明文が無いとき、作成すると、英語と日本語の説明文ペアが無いことを示すエラーになる", () => {
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

  describe("バージョン X と Y の英語・日本語の説明文があるとき", () => {
    describe("単体テスト", () => {
      describe("正常系", () => {
        it("フシギダネのバージョン X の英語の説明文が「A strange seed was planted on its back at birth.⏎The plant sprouts and grows with this Pokémon.」のとき、作成したポケモンデータの英語の説明文は「A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokémon.」になる", () => {
          expect(convertBulbasaur().description_en).toBe(
            "A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokémon.",
          );
        });

        it("ヒトカゲのバージョン X の英語の説明文が「The flame on its tail indicates Charmander’s life⏎force. If it is healthy, the flame burns brightly.」のとき、作成したポケモンデータの英語の説明文は「The flame on its tail indicates Charmander’s life force. If it is healthy, the flame burns brightly.」になる", () => {
          expect(convertCharmander().description_en).toBe(
            "The flame on its tail indicates Charmander’s life force. If it is healthy, the flame burns brightly.",
          );
        });

        it("フシギダネのバージョン X の日本語の説明文が「生まれたときから　背中に⏎不思議な　タネが　植えてあって⏎体と　ともに　育つという。」のとき、作成したポケモンデータの日本語の説明文は「生まれたときから　背中に 不思議な　タネが　植えてあって 体と　ともに　育つという。」になる", () => {
          expect(convertBulbasaur().description_ja).toBe(
            "生まれたときから　背中に 不思議な　タネが　植えてあって 体と　ともに　育つという。",
          );
        });

        it("ヒトカゲのバージョン X の日本語の説明文が「尻尾の　炎は⏎ヒトカゲの　生命力の　証。⏎元気だと　さかんに　燃えさかる。」のとき、作成したポケモンデータの日本語の説明文は「尻尾の　炎は ヒトカゲの　生命力の　証。 元気だと　さかんに　燃えさかる。」になる", () => {
          expect(convertCharmander().description_ja).toBe(
            "尻尾の　炎は ヒトカゲの　生命力の　証。 元気だと　さかんに　燃えさかる。",
          );
        });
      });
    });

    describe("フシギダネのバージョン X の説明文が英語「A strange seed was planted on its back at birth.⏎The plant sprouts and grows with this Pokémon.」・日本語「生まれたときから　背中に⏎不思議な　タネが　植えてあって⏎体と　ともに　育つという。」、バージョン Y の説明文が英語「For some time after its birth, it grows by gaining⏎nourishment from the seed on its back.」・日本語「生まれてから　しばらくの　あいだは⏎背中の　タネから　栄養を　もらって⏎大きく　育つ。」のとき", () => {
      describe("単体テスト", () => {
        describe("正常系", () => {
          it("作成したポケモンデータの説明文ペアの一覧は 2 組になる", () => {
            expect(convertBulbasaur().flavor_texts).toHaveLength(2);
          });

          it("作成したポケモンデータの説明文ペアの一覧の 1 組目は、バージョン名 X・英語「A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokémon.」・日本語「生まれたときから　背中に 不思議な　タネが　植えてあって 体と　ともに　育つという。」になる", () => {
            expect(convertBulbasaur().flavor_texts?.[0]).toEqual({
              version_names: ["X"],
              description_en: "A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokémon.",
              description_ja: "生まれたときから　背中に 不思議な　タネが　植えてあって 体と　ともに　育つという。",
            });
          });

          it("作成したポケモンデータの説明文ペアの一覧の 2 組目は、バージョン名 Y・英語「For some time after its birth, it grows by gaining nourishment from the seed on its back.」・日本語「生まれてから　しばらくの　あいだは 背中の　タネから　栄養を　もらって 大きく　育つ。」になる", () => {
            expect(convertBulbasaur().flavor_texts?.[1]).toEqual({
              version_names: ["Y"],
              description_en: "For some time after its birth, it grows by gaining nourishment from the seed on its back.",
              description_ja: "生まれてから　しばらくの　あいだは 背中の　タネから　栄養を　もらって 大きく　育つ。",
            });
          });
        });
      });
    });

    describe("ヒトカゲのバージョン X の説明文が英語「The flame on its tail indicates Charmander’s life⏎force. If it is healthy, the flame burns brightly.」・日本語「尻尾の　炎は⏎ヒトカゲの　生命力の　証。⏎元気だと　さかんに　燃えさかる。」、バージョン Y の説明文が英語「From the time it is born, a flame burns at the tip of⏎its tail. Its life would end if the flame were to⏎go out.」・日本語「生まれたときから　尻尾に　炎が⏎点っている。炎が　消えたとき⏎その　命は　終わってしまう。」のとき", () => {
      describe("単体テスト", () => {
        describe("正常系", () => {
          it("作成したポケモンデータの説明文ペアの一覧は 2 組になる", () => {
            expect(convertCharmander().flavor_texts).toHaveLength(2);
          });

          it("作成したポケモンデータの説明文ペアの一覧の 1 組目は、バージョン名 X・英語「The flame on its tail indicates Charmander’s life force. If it is healthy, the flame burns brightly.」・日本語「尻尾の　炎は ヒトカゲの　生命力の　証。 元気だと　さかんに　燃えさかる。」になる", () => {
            expect(convertCharmander().flavor_texts?.[0]).toEqual({
              version_names: ["X"],
              description_en: "The flame on its tail indicates Charmander’s life force. If it is healthy, the flame burns brightly.",
              description_ja: "尻尾の　炎は ヒトカゲの　生命力の　証。 元気だと　さかんに　燃えさかる。",
            });
          });

          it("作成したポケモンデータの説明文ペアの一覧の 2 組目は、バージョン名 Y・英語「From the time it is born, a flame burns at the tip of its tail. Its life would end if the flame were to go out.」・日本語「生まれたときから　尻尾に　炎が 点っている。炎が　消えたとき その　命は　終わってしまう。」になる", () => {
            expect(convertCharmander().flavor_texts?.[1]).toEqual({
              version_names: ["Y"],
              description_en: "From the time it is born, a flame burns at the tip of its tail. Its life would end if the flame were to go out.",
              description_ja: "生まれたときから　尻尾に　炎が 点っている。炎が　消えたとき その　命は　終わってしまう。",
            });
          });
        });
      });
    });
  });
});
