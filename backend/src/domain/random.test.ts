import { describe, it, expect } from "vitest";
import { pickRandomSample } from "./random.js";
import type { RandomSource } from "./ports.js";

function fixedRandom(value: number): RandomSource {
  return { next: () => value };
}

describe("[乱数] プールからの重複無し抽選", () => {
  describe("正常系", () => {
    it("プールが 4 件で 3 件を指定したとき、選ばれる件数は 3 件になる", () => {
      const picked = pickRandomSample(["a", "b", "c", "d"], 3, fixedRandom(0));
      expect(picked).toHaveLength(3);
    });

    it("プールが 4 件で 3 件を指定したとき、選ばれた 3 件に重複は無い", () => {
      const picked = pickRandomSample(["a", "b", "c", "d"], 3, fixedRandom(0));
      expect(new Set(picked).size).toBe(3);
    });

    it("プールが 2 件で 5 件を指定したとき、選ばれる件数は 2 件になる", () => {
      const picked = pickRandomSample(["a", "b"], 5, fixedRandom(0));
      expect(picked).toHaveLength(2);
    });
  });

  describe("異常系", () => {
    it.each([
      ["プールが空で 3 件を指定した", [], 3],
      ["プールが 2 件で 0 件を指定した", ["a", "b"], 0],
    ])("%sとき、選ばれた一覧は空になる", (_label, pool, count) => {
      expect(pickRandomSample(pool, count, fixedRandom(0))).toEqual([]);
    });
  });
});
