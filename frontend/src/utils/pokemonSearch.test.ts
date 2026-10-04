import { describe, it, expect } from "vitest";
import { searchPokemonByName } from "./pokemonSearch";

// 五十音順への並べ替えを検証できるよう、あえて五十音順ではない順で並べる。
const entries = [
  { name_ja: "アズマオウ" },
  { name_ja: "アーボック" },
  { name_ja: "イーブイ" },
  { name_ja: "アーボ" },
];

describe("[苦手ポケモン検索] ポケモン名の前方一致検索", () => {
  describe("異常系", () => {
    it("検索欄が空文字のとき、検索結果は 0 件になる", () => {
      expect(searchPokemonByName(entries, "")).toEqual([]);
    });
  });

  describe("正常系", () => {
    it("検索欄が「ゼッ」で、どのポケモン名の先頭にも一致しないとき、検索結果は 0 件になる", () => {
      expect(searchPokemonByName(entries, "ゼッ")).toEqual([]);
    });

    describe("検索欄の文字で始まる名前のポケモンがあるとき", () => {
      it("検索欄が「ア」のとき、「ア」で始まる 3 件が五十音順 (アーボ、アーボック、アズマオウ) で検索結果になる", () => {
        expect(searchPokemonByName(entries, "ア").map((e) => e.name_ja)).toEqual([
          "アーボ",
          "アーボック",
          "アズマオウ",
        ]);
      });

      it("検索欄が「アー」のとき、1 文字目だけが一致する「アズマオウ」は含まれず、「アー」で始まる 2 件が五十音順 (アーボ、アーボック) で検索結果になる", () => {
        expect(searchPokemonByName(entries, "アー").map((e) => e.name_ja)).toEqual([
          "アーボ",
          "アーボック",
        ]);
      });

      it("検索欄が「アーボッ」のとき、「アーボック」の 1 件だけが検索結果になる", () => {
        expect(searchPokemonByName(entries, "アーボッ").map((e) => e.name_ja)).toEqual([
          "アーボック",
        ]);
      });

      it("検索欄がひらがなの「あーぼ」のとき、カタカナ名の「アーボ」「アーボック」が五十音順で検索結果になる", () => {
        expect(searchPokemonByName(entries, "あーぼ").map((e) => e.name_ja)).toEqual([
          "アーボ",
          "アーボック",
        ]);
      });
    });
  });
});
