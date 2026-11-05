import { describe, expect } from "vitest";
import {
  generationsToPokemonIDs,
  buildQuestPoolIDs,
  validateEnabledGenerations,
} from "./generation.js";
import { defineCase } from "../test/defineCase.js";

const FIND_IDS = "クエスト画面で出題するポケモンを選ぶために、選択世代に含まれる図鑑番号を求める";
const GENERATIONS_2_AND_4 = "第2世代と第4世代が選択されているとき";

describe("[本体:クエスト]選択世代に含まれる図鑑番号", () => {
  for (const { generation, id } of [
    { generation: 1, id: 1 },
    { generation: 1, id: 151 },
    { generation: 2, id: 152 },
    { generation: 2, id: 251 },
    { generation: 3, id: 252 },
    { generation: 3, id: 386 },
    { generation: 4, id: 387 },
    { generation: 4, id: 493 },
    { generation: 5, id: 494 },
    { generation: 5, id: 649 },
    { generation: 6, id: 650 },
    { generation: 6, id: 721 },
    { generation: 7, id: 722 },
    { generation: 7, id: 809 },
    { generation: 8, id: 810 },
    { generation: 8, id: 898 },
  ]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        steps: [{ Given: `第${generation}世代のみが選択されているとき`, When: [FIND_IDS], Then: `図鑑番号 ${id} を含む` }],
      },
      () => {
        expect(generationsToPokemonIDs([generation]).has(id)).toBe(true);
      },
    );
  }

  for (const { generation, id } of [
    { generation: 1, id: 0 },
    { generation: 1, id: 152 },
    { generation: 2, id: 151 },
    { generation: 2, id: 252 },
    { generation: 3, id: 251 },
    { generation: 3, id: 387 },
    { generation: 4, id: 386 },
    { generation: 4, id: 494 },
    { generation: 5, id: 493 },
    { generation: 5, id: 650 },
    { generation: 6, id: 649 },
    { generation: 6, id: 722 },
    { generation: 7, id: 721 },
    { generation: 7, id: 810 },
    { generation: 8, id: 809 },
    { generation: 8, id: 899 },
  ]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        steps: [{ Given: `第${generation}世代のみが選択されているとき`, When: [FIND_IDS], Then: `図鑑番号 ${id} を含まない` }],
      },
      () => {
        expect(generationsToPokemonIDs([generation]).has(id)).toBe(false);
      },
    );
  }

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: "第1世代のみが選択されているとき", When: [FIND_IDS], Then: "図鑑番号は 151 件になる" }],
    },
    () => {
      expect(generationsToPokemonIDs([1]).size).toBe(151);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: GENERATIONS_2_AND_4, When: [FIND_IDS], Then: "図鑑番号は 207 件になる" }],
    },
    () => {
      expect(generationsToPokemonIDs([2, 4]).size).toBe(207);
    },
  );

  for (const id of [251, 387]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        steps: [{ Given: GENERATIONS_2_AND_4, When: [FIND_IDS], Then: `図鑑番号 ${id} を含む` }],
      },
      () => {
        expect(generationsToPokemonIDs([2, 4]).has(id)).toBe(true);
      },
    );
  }

  for (const id of [252, 386]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        steps: [
          { Given: GENERATIONS_2_AND_4, When: [FIND_IDS], Then: `選択していない第3世代の図鑑番号 ${id} を含まない` },
        ],
      },
      () => {
        expect(generationsToPokemonIDs([2, 4]).has(id)).toBe(false);
      },
    );
  }

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      steps: [{ Given: "世代を 1 つも選択していないとき", When: [FIND_IDS], Then: "図鑑番号は 0 件になる" }],
    },
    () => {
      expect(generationsToPokemonIDs([]).size).toBe(0);
    },
  );
});

const BUILD_POOL = "クエスト画面で出題するポケモンを選ぶために、出題プールを作る";
const GENERATION_1_WITH_EXCLUSIONS = "第1世代が選択され、図鑑番号 5 と 10 が除外されているとき";

describe("[本体:クエスト]出題プールの図鑑番号", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: GENERATION_1_WITH_EXCLUSIONS, When: [BUILD_POOL], Then: "出題プールは 149 件になる" }],
    },
    () => {
      const pool = buildQuestPoolIDs([1], new Set([5, 10]));
      expect(pool.size).toBe(149);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: GENERATION_1_WITH_EXCLUSIONS,
          When: [BUILD_POOL],
          Then: "除外した図鑑番号 5 と 10 は出題プールに含まれない",
        },
      ],
    },
    () => {
      const pool = buildQuestPoolIDs([1], new Set([5, 10]));
      expect(pool.has(5)).toBe(false);
      expect(pool.has(10)).toBe(false);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: GENERATION_1_WITH_EXCLUSIONS,
          When: [BUILD_POOL],
          Then: "除外していない図鑑番号 1 は出題プールに含まれる",
        },
      ],
    },
    () => {
      const pool = buildQuestPoolIDs([1], new Set([5, 10]));
      expect(pool.has(1)).toBe(true);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "第1世代が選択され、除外された図鑑番号が 0 件のとき",
          When: [BUILD_POOL],
          Then: "出題プールは 151 件になる",
        },
      ],
    },
    () => {
      const pool = buildQuestPoolIDs([1], new Set());
      expect(pool.size).toBe(151);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "第1世代が選択され、第1世代の図鑑番号 5 だけが除外されているとき",
          When: [BUILD_POOL],
          Then: "出題プールは 150 件になる",
        },
      ],
    },
    () => {
      const pool = buildQuestPoolIDs([1], new Set([5]));
      expect(pool.size).toBe(150);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "第1世代が選択され、第1世代の外にある図鑑番号 200 が除外されているとき",
          When: [BUILD_POOL],
          Then: "出題プールは 151 件になる",
        },
      ],
    },
    () => {
      const pool = buildQuestPoolIDs([1], new Set([200]));
      expect(pool.size).toBe(151);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: "第1世代が選択され、第1世代の 151 件の図鑑番号がすべて除外されているとき",
          When: [BUILD_POOL],
          Then: "出題プールは空になる",
        },
      ],
    },
    () => {
      const allGen1 = new Set(Array.from({ length: 151 }, (_, i) => i + 1));
      const pool = buildQuestPoolIDs([1], allGen1);
      expect(pool.size).toBe(0);
    },
  );
});

const VALIDATE_GENERATIONS = "設定画面の「出題する世代」の変更を保存するために、出題世代設定を検証する";

describe("[共通:設定]出題世代設定の検証", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "順不同で重複した世代 (第3世代・第1世代・第1世代) が指定されているとき",
          When: [VALIDATE_GENERATIONS],
          Then: "重複が除かれ第1世代・第3世代の昇順で受理される",
        },
      ],
    },
    () => {
      expect(validateEnabledGenerations([3, 1, 1])).toEqual({ ok: true, generations: [1, 3] });
    },
  );

  for (const { given, generation } of [
    { given: "最小の第1世代だけが指定されているとき", generation: 1 },
    { given: "最大の第8世代だけが指定されているとき", generation: 8 },
  ]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        steps: [{ Given: given, When: [VALIDATE_GENERATIONS], Then: "受理される" }],
      },
      () => {
        expect(validateEnabledGenerations([generation]).ok).toBe(true);
      },
    );
  }

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: "世代の一覧が空のとき",
          When: [VALIDATE_GENERATIONS],
          Then: "最低 1 世代が必要という理由で検証に失敗する",
        },
      ],
    },
    () => {
      expect(validateEnabledGenerations([])).toEqual({
        ok: false,
        message: "at least one generation must be selected",
      });
    },
  );

  for (const { given, raw } of [
    { given: "世代の指定が一覧でなく文字列 x のとき", raw: "x" },
    { given: "世代の指定がリクエストの本文に無いとき", raw: undefined },
  ]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "異常系",
        steps: [
          {
            Given: given,
            When: [VALIDATE_GENERATIONS],
            Then: "世代は一覧で指定する必要があるという理由で検証に失敗する",
          },
        ],
      },
      () => {
        expect(validateEnabledGenerations(raw)).toEqual({
          ok: false,
          message: "generations must be an array",
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
          Given: "世代に最小の 1 を下回る 0 が指定されているとき",
          When: [VALIDATE_GENERATIONS],
          Then: "未知の世代 0 という理由で検証に失敗する",
        },
      ],
    },
    () => {
      expect(validateEnabledGenerations([0])).toEqual({
        ok: false,
        message: "unknown generation: 0 (must be one of 1,2,3,4,5,6,7,8)",
      });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: "世代に最大の 8 を上回る 9 が指定されているとき",
          When: [VALIDATE_GENERATIONS],
          Then: "未知の世代 9 という理由で検証に失敗する",
        },
      ],
    },
    () => {
      expect(validateEnabledGenerations([9])).toEqual({
        ok: false,
        message: "unknown generation: 9 (must be one of 1,2,3,4,5,6,7,8)",
      });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: "世代に整数でない 1.5 が指定されているとき",
          When: [VALIDATE_GENERATIONS],
          Then: "未知の世代 1.5 という理由で検証に失敗する",
        },
      ],
    },
    () => {
      expect(validateEnabledGenerations([1.5])).toEqual({
        ok: false,
        message: "unknown generation: 1.5 (must be one of 1,2,3,4,5,6,7,8)",
      });
    },
  );
});
