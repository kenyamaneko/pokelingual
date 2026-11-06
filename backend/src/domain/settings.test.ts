import { describe, expect } from "vitest";
import { validateExcludedPokemonIDs } from "./settings.js";
import { defineCase } from "../test/defineCase.js";

const SERVABLE_IDS = new Set([1, 4, 7, 25, 150]);
const MAX_COUNT = 3;

const GIVEN_LIMIT = "出題可能な図鑑番号が 1・4・7・25・150 で、除外ポケモンの件数の上限が 3 件で、";
const VALIDATE = "除外ポケモン設定を検証する";
const NOT_ARRAY_REASON = "除外する図鑑番号は一覧で指定する必要があることを示すエラーになる";

describe("[共通:設定]除外ポケモン設定の検証", () => {
  for (const { given, raw } of [
    {
      given: "除外ポケモンの指定に、重複した番号と順不同の番号 7・1・7・4 が含まれているとき",
      raw: [7, 1, 7, 4],
    },
    {
      given:
        "除外ポケモンの指定が、重複を含めると上限を超える 1・1・4・4・7・7 で、重複を除いた件数が上限以内のとき",
      raw: [1, 1, 4, 4, 7, 7],
    },
  ]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        steps: [
          {
            Given: `${GIVEN_LIMIT}${given}`,
            When: [VALIDATE],
            Then: "検証後の除外ポケモンは図鑑番号 1・4・7 の昇順になる",
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
      steps: [
        {
          Given: `${GIVEN_LIMIT}除外する図鑑番号の一覧が空のとき`,
          When: [VALIDATE],
          Then: "検証後の除外ポケモンは空になる",
        },
      ],
    },
    () => {
      expect(validateExcludedPokemonIDs([], SERVABLE_IDS, MAX_COUNT)).toEqual({ ok: true, ids: [] });
    },
  );

  for (const { given, raw } of [
    { given: "出題可能な図鑑番号 25 が 1 件だけ指定されているとき", raw: [25] },
    { given: "出題可能な図鑑番号 1・4・7 が上限と同じ 3 件だけ指定されているとき", raw: [1, 4, 7] },
  ]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        steps: [{ Given: `${GIVEN_LIMIT}${given}`, When: [VALIDATE], Then: "検証の結果は受理になる" }],
      },
      () => {
        expect(validateExcludedPokemonIDs(raw, SERVABLE_IDS, MAX_COUNT).ok).toBe(true);
      },
    );
  }

  for (const { given, raw } of [
    { given: "除外する図鑑番号の指定が一覧でなく文字列 x のとき", raw: "x" },
    { given: "除外する図鑑番号の指定が無いとき", raw: undefined },
  ]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "異常系",
        steps: [{ Given: `${GIVEN_LIMIT}${given}`, When: [VALIDATE], Then: NOT_ARRAY_REASON }],
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
      steps: [
        {
          Given: `${GIVEN_LIMIT}出題可能な図鑑番号の最小と最大のあいだにある欠番 5 が指定されているとき`,
          When: [VALIDATE],
          Then: "図鑑番号 5 が出題可能な図鑑番号に無いことを示すエラーになる",
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
      steps: [
        {
          Given: `${GIVEN_LIMIT}整数でない 1.5 が指定されているとき`,
          When: [VALIDATE],
          Then: "図鑑番号 1.5 が出題可能な図鑑番号に無いことを示すエラーになる",
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
      steps: [
        {
          Given: `${GIVEN_LIMIT}指定された図鑑番号が上限を 1 件超える 1・4・7・25 の 4 件のとき`,
          When: [VALIDATE],
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
