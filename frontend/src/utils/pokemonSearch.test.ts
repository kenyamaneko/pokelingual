import { describe, expect } from "vitest";
import { searchPokemonByName } from "./pokemonSearch";
import { defineCase } from "../test/defineCase";

const entries = [
  { name_ja: "アズマオウ" },
  { name_ja: "アーボック" },
  { name_ja: "イーブイ" },
  { name_ja: "アーボ" },
];

const ENTRIES_GIVEN = "検索対象のポケモン名が「アズマオウ」「アーボック」「イーブイ」「アーボ」の順で並んでいて";
const SEARCH_POKEMON_NAME = "ポケモン名を検索する";

describe("[本体:設定]ポケモン名の前方一致検索", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: `${ENTRIES_GIVEN}、検索欄が空文字のとき`,
          When: [SEARCH_POKEMON_NAME],
          Then: "検索結果は 0 件になる",
        },
      ],
    },
    () => {
      expect(searchPokemonByName(entries, "")).toEqual([]);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: `${ENTRIES_GIVEN}、検索欄が「ゼッ」で、どのポケモン名の先頭にも一致しないとき`,
          When: [SEARCH_POKEMON_NAME],
          Then: "検索結果は 0 件になる",
        },
      ],
    },
    () => {
      expect(searchPokemonByName(entries, "ゼッ")).toEqual([]);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: `${ENTRIES_GIVEN}、検索欄が「ア」のとき`,
          When: [SEARCH_POKEMON_NAME],
          Then: "「ア」で始まる 3 件が五十音順 (アーボ、アーボック、アズマオウ) で検索結果になる",
        },
      ],
    },
    () => {
      expect(searchPokemonByName(entries, "ア").map((e) => e.name_ja)).toEqual([
        "アーボ",
        "アーボック",
        "アズマオウ",
      ]);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: `${ENTRIES_GIVEN}、検索欄が「アー」のとき`,
          When: [SEARCH_POKEMON_NAME],
          Then: "「アー」で始まる 2 件が五十音順 (アーボ、アーボック) で検索結果になり、1 文字目だけが一致する「アズマオウ」は含まれない",
        },
      ],
    },
    () => {
      expect(searchPokemonByName(entries, "アー").map((e) => e.name_ja)).toEqual([
        "アーボ",
        "アーボック",
      ]);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: `${ENTRIES_GIVEN}、検索欄が「アーボッ」のとき`,
          When: [SEARCH_POKEMON_NAME],
          Then: "「アーボック」の 1 件だけが検索結果になる",
        },
      ],
    },
    () => {
      expect(searchPokemonByName(entries, "アーボッ").map((e) => e.name_ja)).toEqual([
        "アーボック",
      ]);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: `${ENTRIES_GIVEN}、検索欄がひらがなの「あーぼ」のとき`,
          When: [SEARCH_POKEMON_NAME],
          Then: "カタカナ名の「アーボ」「アーボック」が五十音順で検索結果になる",
        },
      ],
    },
    () => {
      expect(searchPokemonByName(entries, "あーぼ").map((e) => e.name_ja)).toEqual([
        "アーボ",
        "アーボック",
      ]);
    },
  );
});
