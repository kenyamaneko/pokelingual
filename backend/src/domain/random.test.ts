import { describe, expect } from "vitest";
import { pickRandomSample } from "./random.js";
import type { RandomSource } from "./ports.js";
import { defineCase } from "../test/defineCase.js";

function fixedRandom(value: number): RandomSource {
  return { next: () => value };
}

function drawFromPool(poolSize: number, count: number): string {
  return `${poolSize} 件のプールから ${count} 件抽選する`;
}

const DRAW_3_FROM_POOL_OF_FOUR = drawFromPool(4, 3);

describe("[共通:機能共通]プールからの重複無し抽選", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["同値分割"],
      steps: [{ When: [DRAW_3_FROM_POOL_OF_FOUR], Then: "選ばれる件数は 3 件になる" }],
    },
    () => {
      const picked = pickRandomSample(["a", "b", "c", "d"], 3, fixedRandom(0));
      expect(picked).toHaveLength(3);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["同値分割"],
      steps: [{ When: [DRAW_3_FROM_POOL_OF_FOUR], Then: "選ばれた 3 件に重複は無い" }],
    },
    () => {
      const picked = pickRandomSample(["a", "b", "c", "d"], 3, fixedRandom(0));
      expect(new Set(picked).size).toBe(3);
    },
  );

  for (const count of [4, 5]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        観点: ["境界値"],
        steps: [{ When: [drawFromPool(4, count)], Then: "選ばれる件数は 4 件になる" }],
      },
      () => {
        const picked = pickRandomSample(["a", "b", "c", "d"], count, fixedRandom(0));
        expect(picked).toHaveLength(4);
      },
    );
  }

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["件数・有無"],
      steps: [{ When: [drawFromPool(1, 1)], Then: "選ばれた一覧はその 1 件になる" }],
    },
    () => {
      expect(pickRandomSample(["a"], 1, fixedRandom(0))).toEqual(["a"]);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["同値分割"],
      steps: [{ When: [drawFromPool(2, 5)], Then: "選ばれる件数は 2 件になる" }],
    },
    () => {
      const picked = pickRandomSample(["a", "b"], 5, fixedRandom(0));
      expect(picked).toHaveLength(2);
    },
  );

  for (const { count, pool, viewpoints } of [
    { count: 3, pool: [] as string[], viewpoints: ["件数・有無", "エッジケース"] as const },
    { count: 0, pool: ["a", "b"], viewpoints: ["件数・有無"] as const },
  ]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "異常系",
        観点: viewpoints,
        steps: [{ When: [drawFromPool(pool.length, count)], Then: "選ばれた一覧は空になる" }],
      },
      () => {
        expect(pickRandomSample(pool, count, fixedRandom(0))).toEqual([]);
      },
    );
  }
});
