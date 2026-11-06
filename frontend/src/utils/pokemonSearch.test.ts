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
const SEARCH_POKEMON_NAME = "ポケモン名を前方一致で検索する";

describe("[共通:設定]ポケモン名の前方一致検索", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      観点: ["件数・有無"],
      steps: [
        {
          Given: `${ENTRIES_GIVEN}、検索語が空文字のとき`,
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
      観点: ["件数・有無"],
      steps: [
        {
          Given: `${ENTRIES_GIVEN}、検索語が「ゼッ」で、どのポケモン名の先頭にも一致しないとき`,
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
      観点: ["件数・有無"],
      steps: [
        {
          Given: `${ENTRIES_GIVEN}、検索語が「ア」のとき`,
          When: [SEARCH_POKEMON_NAME],
          Then: "検索結果は、五十音順にアーボ、アーボック、アズマオウの 3 件になる",
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
          Given: `${ENTRIES_GIVEN}、検索語が「アー」のとき`,
          When: [SEARCH_POKEMON_NAME],
          Then: "検索結果は、五十音順にアーボ、アーボックの 2 件になる",
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
      観点: ["件数・有無"],
      steps: [
        {
          Given: `${ENTRIES_GIVEN}、検索語が「アーボッ」のとき`,
          When: [SEARCH_POKEMON_NAME],
          Then: "検索結果は、アーボックの 1 件になる",
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
          Given: `${ENTRIES_GIVEN}、検索語がひらがなの「あーぼ」のとき`,
          When: [SEARCH_POKEMON_NAME],
          Then: "検索結果は、五十音順にアーボ、アーボックの 2 件になる",
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
