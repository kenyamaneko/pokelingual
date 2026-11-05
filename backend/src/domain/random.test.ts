import { describe, expect } from "vitest";
import { pickRandomSample } from "./random.js";
import type { RandomSource } from "./ports.js";
import { defineCase } from "../test/defineCase.js";

function fixedRandom(value: number): RandomSource {
  return { next: () => value };
}

const POOL_OF_FOUR = "プールが 4 件のとき";

function drawFromPool(count: number): string {
  return `クエスト画面のポケモン名当てのヒントに出す技を、プールから ${count} 件抽選する`;
}

const DRAW_3 = drawFromPool(3);

describe("[共通:機能共通]プールからの重複無し抽選", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: POOL_OF_FOUR, When: [DRAW_3], Then: "選ばれる件数は 3 件になる" }],
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
      steps: [{ Given: POOL_OF_FOUR, When: [DRAW_3], Then: "選ばれた 3 件に重複は無い" }],
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
        steps: [{ Given: POOL_OF_FOUR, When: [drawFromPool(count)], Then: "選ばれる件数は 4 件になる" }],
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
      steps: [{ Given: "プールが 1 件のとき", When: [drawFromPool(1)], Then: "選ばれた一覧はその 1 件になる" }],
    },
    () => {
      expect(pickRandomSample(["a"], 1, fixedRandom(0))).toEqual(["a"]);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: "プールが 2 件のとき", When: [drawFromPool(5)], Then: "選ばれる件数は 2 件になる" }],
    },
    () => {
      const picked = pickRandomSample(["a", "b"], 5, fixedRandom(0));
      expect(picked).toHaveLength(2);
    },
  );

  for (const { given, count, pool } of [
    { given: "プールが空のとき", count: 3, pool: [] as string[] },
    { given: "プールが 2 件のとき", count: 0, pool: ["a", "b"] },
  ]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "異常系",
        steps: [{ Given: given, When: [drawFromPool(count)], Then: "選ばれた一覧は空になる" }],
      },
      () => {
        expect(pickRandomSample(pool, count, fixedRandom(0))).toEqual([]);
      },
    );
  }
});
