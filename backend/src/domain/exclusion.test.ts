import { describe, expect } from "vitest";
import { buildExcludedPokemonIDs } from "./exclusion.js";
import { defineCase } from "../test/defineCase.js";

const DECIDE_EXCLUDED_POKEMON = "クエスト画面の出題の除外のため、除外ポケモンの一覧を決める";

describe("[本体:クエスト]出題除外の決定", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "ユーザーが除外ポケモンを設定していないとき",
          When: [DECIDE_EXCLUDED_POKEMON],
          Then: "除外ポケモンの一覧は空になる",
        },
      ],
    },
    () => {
      expect(buildExcludedPokemonIDs(null)).toEqual(new Set());
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "ユーザーが除外ポケモンを 0 匹で設定しているとき",
          When: [DECIDE_EXCLUDED_POKEMON],
          Then: "除外ポケモンの一覧は空になる",
        },
      ],
    },
    () => {
      expect(buildExcludedPokemonIDs([])).toEqual(new Set());
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "ユーザーが図鑑番号 10 のポケモンだけを除外に設定しているとき",
          When: [DECIDE_EXCLUDED_POKEMON],
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
      steps: [
        {
          Given: "ユーザーが図鑑番号 10 と 20 のポケモンを除外に設定しているとき",
          When: [DECIDE_EXCLUDED_POKEMON],
          Then: "除外ポケモンの一覧は図鑑番号 10 と 20 になる",
        },
      ],
    },
    () => {
      expect(buildExcludedPokemonIDs([10, 20])).toEqual(new Set([10, 20]));
    },
  );
});
