import { describe, expect } from "vitest";
import {
  collectPokemonIDsByGenerations,
  buildQuestPoolIDs,
  validateEnabledGenerations,
} from "./generation.js";
import { defineCase } from "../test/defineCase.js";

function findIDsOf(generationsText: string): string {
  return `出題世代に${generationsText}を指定して、含まれる全国図鑑番号の一覧を求める`;
}

const FIND_IDS_OF_GENERATIONS_2_AND_4 = findIDsOf("第 2 世代と第 4 世代");

describe("[本体:クエスト]出題世代に含まれる全国図鑑番号", () => {
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
        観点: ["境界値"],
        steps: [{ When: [findIDsOf(`第 ${generation} 世代だけ`)], Then: `出題世代に含まれる全国図鑑番号の一覧は、全国図鑑番号 ${id} を含む` }],
      },
      () => {
        expect(collectPokemonIDsByGenerations([generation]).has(id)).toBe(true);
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
        観点: ["境界値"],
        steps: [{ When: [findIDsOf(`第 ${generation} 世代だけ`)], Then: `出題世代に含まれる全国図鑑番号の一覧は、全国図鑑番号 ${id} を含まない` }],
      },
      () => {
        expect(collectPokemonIDsByGenerations([generation]).has(id)).toBe(false);
      },
    );
  }

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ When: [findIDsOf("第 1 世代だけ")], Then: "全国図鑑番号は 151 件になる" }],
    },
    () => {
      expect(collectPokemonIDsByGenerations([1]).size).toBe(151);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ When: [FIND_IDS_OF_GENERATIONS_2_AND_4], Then: "全国図鑑番号は 207 件になる" }],
    },
    () => {
      expect(collectPokemonIDsByGenerations([2, 4]).size).toBe(207);
    },
  );

  for (const id of [251, 387]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        観点: ["境界値"],
        steps: [{ When: [FIND_IDS_OF_GENERATIONS_2_AND_4], Then: `出題世代に含まれる全国図鑑番号の一覧は、全国図鑑番号 ${id} を含む` }],
      },
      () => {
        expect(collectPokemonIDsByGenerations([2, 4]).has(id)).toBe(true);
      },
    );
  }

  for (const id of [252, 386]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        観点: ["境界値"],
        steps: [
          { When: [FIND_IDS_OF_GENERATIONS_2_AND_4], Then: `出題世代に含まれる全国図鑑番号の一覧は、全国図鑑番号 ${id} を含まない` },
        ],
      },
      () => {
        expect(collectPokemonIDsByGenerations([2, 4]).has(id)).toBe(false);
      },
    );
  }

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      観点: ["件数・有無"],
      steps: [{ When: ["出題世代に世代を 1 つも指定せずに、含まれる全国図鑑番号の一覧を求める"], Then: "全国図鑑番号は 0 件になる" }],
    },
    () => {
      expect(collectPokemonIDsByGenerations([]).size).toBe(0);
    },
  );
});

function buildPoolWith(excludedText: string): string {
  return `出題世代に第 1 世代、除外ポケモンに${excludedText}を指定して、出題プールを作る`;
}

const BUILD_POOL_EXCLUDING_5_AND_10 = buildPoolWith("全国図鑑番号 5 と 10");

describe("[本体:クエスト]出題プールの全国図鑑番号", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["件数・有無"],
      steps: [{ When: [BUILD_POOL_EXCLUDING_5_AND_10], Then: "出題プールは 149 件になる" }],
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
          When: [BUILD_POOL_EXCLUDING_5_AND_10],
          Then: "除外した全国図鑑番号 5 と 10 は出題プールに含まれない",
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
          When: [BUILD_POOL_EXCLUDING_5_AND_10],
          Then: "除外していない全国図鑑番号 1 は出題プールに含まれる",
        },
      ],
    },
    () => {
      const pool = buildQuestPoolIDs([1], new Set([5, 10]));
      expect(pool.has(1)).toBe(true);
    },
  );

  for (const { when, excluded, viewpoints } of [
    {
      when: "出題世代に第 1 世代を指定し、除外ポケモンに全国図鑑番号を 1 つも指定せずに、出題プールを作る",
      excluded: [] as number[],
      viewpoints: ["件数・有無"] as const,
    },
    {
      when: buildPoolWith("全国図鑑番号 200"),
      excluded: [200],
      viewpoints: [] as const,
    },
  ]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        観点: viewpoints,
        steps: [{ When: [when], Then: "出題プールは 151 件になる" }],
      },
      () => {
        const pool = buildQuestPoolIDs([1], new Set(excluded));
        expect(pool.size).toBe(151);
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
          When: [buildPoolWith("全国図鑑番号 5 だけ")],
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
      正常異常: "異常系",
      観点: ["件数・有無"],
      steps: [
        {
          When: [buildPoolWith("全国図鑑番号 1 から 151 のすべて")],
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

function validateGenerationsWith(inputText: string): string {
  return `${inputText}、出題世代設定を検証する`;
}

describe("[共通:設定]出題世代設定の検証", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          When: [validateGenerationsWith("世代 3・1・1 を指定して")],
          Then: "検証後の出題世代は第1世代・第3世代の昇順になる",
        },
      ],
    },
    () => {
      expect(validateEnabledGenerations([3, 1, 1])).toEqual({ ok: true, generations: [1, 3] });
    },
  );

  for (const generation of [1, 8]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        観点: ["境界値"],
        steps: [{ When: [validateGenerationsWith(`世代 ${generation} を指定して`)], Then: "検証の結果は受理になる" }],
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
      観点: ["件数・有無"],
      steps: [
        {
          When: [validateGenerationsWith("世代を 1 つも指定せずに")],
          Then: "1 つ以上の世代の選択が必要なことを示すエラーになる",
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

  for (const { when, raw, viewpoints } of [
    { when: validateGenerationsWith("世代を一覧でなく文字列で指定して"), raw: "x", viewpoints: ["エッジケース"] as const },
    { when: validateGenerationsWith("世代を指定せずに"), raw: undefined, viewpoints: ["エッジケース", "件数・有無"] as const },
  ]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "異常系",
        観点: viewpoints,
        steps: [
          {
            When: [when],
            Then: "世代は一覧で指定する必要があることを示すエラーになる",
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
      観点: ["境界値"],
      steps: [
        {
          When: [validateGenerationsWith("世代 0 を指定して")],
          Then: "世代 0 が存在しないことを示すエラーになる",
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
      観点: ["境界値"],
      steps: [
        {
          When: [validateGenerationsWith("世代 9 を指定して")],
          Then: "世代 9 が存在しないことを示すエラーになる",
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
      観点: ["エッジケース"],
      steps: [
        {
          When: [validateGenerationsWith("世代 1.5 を指定して")],
          Then: "世代 1.5 が存在しないことを示すエラーになる",
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
