import { describe, expect } from "vitest";
import { validateExcludedPokemonIDs } from "./settings.js";
import { defineCase } from "../test/defineCase.js";

const SERVABLE_IDS = new Set([1, 4, 7, 25, 150]);
const MAX_COUNT = 3;

const GIVEN_LIMIT = "出題可能な図鑑番号が 1・4・7・25・150 で、除外ポケモンの件数の上限が 3 件で、";
const VALIDATE = "設定画面の「苦手ポケモン設定」の変更を保存するために、除外ポケモン設定を検証する";
const NOT_ARRAY_REASON = "除外する図鑑番号は一覧で指定する必要があるという理由で検証に失敗する";

describe("[共通:設定]除外ポケモン設定の検証", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: `${GIVEN_LIMIT}除外ポケモンの指定に、重複した番号と順不同の番号 (7・1・7・4) が含まれているとき`,
          When: [VALIDATE],
          Then: "重複が除かれ 1・4・7 の昇順で受理される",
        },
      ],
    },
    () => {
      expect(validateExcludedPokemonIDs([7, 1, 7, 4], SERVABLE_IDS, MAX_COUNT)).toEqual({ ok: true, ids: [1, 4, 7] });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: `${GIVEN_LIMIT}除外する図鑑番号の一覧が空のとき`,
          When: [VALIDATE],
          Then: "除外なしとして受理される",
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
        steps: [{ Given: `${GIVEN_LIMIT}${given}`, When: [VALIDATE], Then: "受理される" }],
      },
      () => {
        expect(validateExcludedPokemonIDs(raw, SERVABLE_IDS, MAX_COUNT).ok).toBe(true);
      },
    );
  }

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: `${GIVEN_LIMIT}重複を含めると上限を超える 6 件 (1・1・4・4・7・7) で、重複を除いた件数が上限以内のとき`,
          When: [VALIDATE],
          Then: "重複が除かれて 1・4・7 で受理される",
        },
      ],
    },
    () => {
      expect(validateExcludedPokemonIDs([1, 1, 4, 4, 7, 7], SERVABLE_IDS, MAX_COUNT)).toEqual({ ok: true, ids: [1, 4, 7] });
    },
  );

  for (const { given, raw } of [
    { given: "除外する図鑑番号の指定が一覧でなく文字列 x のとき", raw: "x" },
    { given: "除外する図鑑番号の指定がリクエストの本文に無いとき", raw: undefined },
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
          Then: "図鑑番号 5 が出題可能な図鑑番号に無いという理由で検証に失敗する",
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
          Then: "図鑑番号 1.5 が出題可能な図鑑番号に無いという理由で検証に失敗する",
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
          Given: `${GIVEN_LIMIT}指定された件数が上限を 1 件超える 4 件 (1・4・7・25) のとき`,
          When: [VALIDATE],
          Then: "上限を超えているという理由で検証に失敗する",
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
