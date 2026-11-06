import { describe, expect } from "vitest";
import { buildExcludedPokemonIDs } from "./exclusion.js";
import { defineCase } from "../test/defineCase.js";

const BUILD_EXCLUDED_POKEMON_LIST = "出題で除外するポケモンの一覧を作る";

describe("[本体:クエスト]出題除外の決定", () => {
  for (const { when, excludedPokemonIDs } of [
    { when: `除外ポケモンの設定を指定せずに、${BUILD_EXCLUDED_POKEMON_LIST}`, excludedPokemonIDs: null },
    {
      when: `除外ポケモンの設定に図鑑番号を 1 つも指定せずに、${BUILD_EXCLUDED_POKEMON_LIST}`,
      excludedPokemonIDs: [] as number[],
    },
  ]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        観点: ["件数・有無"],
        steps: [{ When: [when], Then: "除外ポケモンの一覧は空になる" }],
      },
      () => {
        expect(buildExcludedPokemonIDs(excludedPokemonIDs)).toEqual(new Set());
      },
    );
  }

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["件数・有無"],
      steps: [
        {
          When: [`除外ポケモンの設定に図鑑番号 10 を指定して、${BUILD_EXCLUDED_POKEMON_LIST}`],
          Then: "除外ポケモンの一覧は図鑑番号 10 だけになる",
        },
      ],
    },
    () => {
      expect(buildExcludedPokemonIDs([10])).toEqual(new Set([10]));
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["件数・有無"],
      steps: [
        {
          When: [`除外ポケモンの設定に図鑑番号 10 と 20 を指定して、${BUILD_EXCLUDED_POKEMON_LIST}`],
          Then: "除外ポケモンの一覧は図鑑番号 10 と 20 になる",
        },
      ],
    },
    () => {
      expect(buildExcludedPokemonIDs([10, 20])).toEqual(new Set([10, 20]));
    },
  );
});
