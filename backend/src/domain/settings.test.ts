import { describe, expect } from "vitest";
import { validateExcludedPokemonIDs } from "./settings.js";
import { defineCase } from "../test/defineCase.js";

const SERVABLE_IDS = new Set([1, 4, 7, 25, 150]);
const MAX_COUNT = 3;

const GIVEN_SERVABLE = "出題可能な全国図鑑番号が 1・4・7・25・150 のとき";
const GIVEN_LIMIT = "出題可能な全国図鑑番号が 1・4・7・25・150 で、除外ポケモンの件数の上限が 3 件のとき";

function validateWith(inputText: string): string {
  return `${inputText}、除外ポケモン設定を検証する`;
}

const NOT_ARRAY_REASON = "除外する全国図鑑番号は一覧で指定する必要があることを示すエラーになる";

describe("[共通:設定]除外ポケモン設定の検証", () => {
  for (const { when, raw } of [
    { when: validateWith("全国図鑑番号 7・1・7・4 を指定して"), raw: [7, 1, 7, 4] },
    { when: validateWith("全国図鑑番号 1・1・4・4・7・7 を指定して"), raw: [1, 1, 4, 4, 7, 7] },
  ]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        steps: [
          {
            Given: GIVEN_LIMIT,
            When: [when],
            Then: "検証後の除外ポケモンは全国図鑑番号 1・4・7 の昇順になる",
          },
        ],
      },
      () => {
        expect(validateExcludedPokemonIDs(raw, SERVABLE_IDS, MAX_COUNT)).toEqual({ ok: true, ids: [1, 4, 7] });
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
          When: [validateWith("全国図鑑番号を 1 つも指定せずに")],
          Then: "検証後の除外ポケモンは空になる",
        },
      ],
    },
    () => {
      expect(validateExcludedPokemonIDs([], SERVABLE_IDS, MAX_COUNT)).toEqual({ ok: true, ids: [] });
    },
  );

  for (const { given, when, raw, viewpoints } of [
    { given: GIVEN_SERVABLE, when: validateWith("全国図鑑番号 25 を指定して"), raw: [25], viewpoints: ["件数・有無"] as const },
    {
      given: GIVEN_LIMIT,
      when: validateWith("全国図鑑番号 1・4・7 を指定して"),
      raw: [1, 4, 7],
      viewpoints: ["境界値"] as const,
    },
  ]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        観点: viewpoints,
        steps: [{ Given: given, When: [when], Then: "検証の結果は受理になる" }],
      },
      () => {
        expect(validateExcludedPokemonIDs(raw, SERVABLE_IDS, MAX_COUNT).ok).toBe(true);
      },
    );
  }

  for (const { when, raw, viewpoints } of [
    { when: validateWith("全国図鑑番号を一覧でなく文字列で指定して"), raw: "x", viewpoints: ["エッジケース"] as const },
    { when: validateWith("全国図鑑番号を指定せずに"), raw: undefined, viewpoints: ["エッジケース", "件数・有無"] as const },
  ]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "異常系",
        観点: viewpoints,
        steps: [{ When: [when], Then: NOT_ARRAY_REASON }],
      },
      () => {
        expect(validateExcludedPokemonIDs(raw, SERVABLE_IDS, MAX_COUNT)).toEqual({
          ok: false,
          message: "excluded_pokemon_ids must be an array",
        });
      },
    );
  }

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      観点: ["同値分割"],
      steps: [
        {
          Given: GIVEN_SERVABLE,
          When: [validateWith("全国図鑑番号 5 を指定して")],
          Then: "全国図鑑番号 5 が出題可能な全国図鑑番号に無いことを示すエラーになる",
        },
      ],
    },
    () => {
      expect(validateExcludedPokemonIDs([5], SERVABLE_IDS, MAX_COUNT)).toEqual({
        ok: false,
        message: "pokemon id not in pokedex: 5",
      });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      観点: ["エッジケース"],
      steps: [
        {
          Given: GIVEN_SERVABLE,
          When: [validateWith("全国図鑑番号 1.5 を指定して")],
          Then: "全国図鑑番号 1.5 が出題可能な全国図鑑番号に無いことを示すエラーになる",
        },
      ],
    },
    () => {
      expect(validateExcludedPokemonIDs([1.5], SERVABLE_IDS, MAX_COUNT)).toEqual({
        ok: false,
        message: "pokemon id not in pokedex: 1.5",
      });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      観点: ["境界値"],
      steps: [
        {
          Given: GIVEN_LIMIT,
          When: [validateWith("全国図鑑番号 1・4・7・25 を指定して")],
          Then: "除外ポケモンの件数が上限を超えていることを示すエラーになる",
        },
      ],
    },
    () => {
      expect(validateExcludedPokemonIDs([1, 4, 7, 25], SERVABLE_IDS, MAX_COUNT)).toEqual({
        ok: false,
        message: "excluded_pokemon_ids exceeds limit (max 3)",
      });
    },
  );
});
