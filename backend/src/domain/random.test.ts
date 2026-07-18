import { describe, it, expect } from "vitest";
import { pickRandomSample } from "./random.js";
import type { RandomSource } from "./ports.js";

/** 固定値を返す乱数ソース。 */
function fixedRandom(value: number): RandomSource {
  return { next: () => value };
}

describe("[乱数] プールからの重複無し抽選", () => {
  it("プールの件数以下を指定したとき、指定した件数だけ重複なく返す", () => {
    const picked = pickRandomSample(["a", "b", "c", "d"], 3, fixedRandom(0));
    expect(picked).toHaveLength(3);
    expect(new Set(picked).size).toBe(3);
  });

  it("プールの件数より多く指定したとき、プールの件数までしか返さない", () => {
    const picked = pickRandomSample(["a", "b"], 5, fixedRandom(0));
    expect(picked).toHaveLength(2);
  });

  it("0件を指定したとき、空配列を返す", () => {
    expect(pickRandomSample(["a", "b"], 0, fixedRandom(0))).toEqual([]);
  });

  it("空のプールを指定したとき、空配列を返す", () => {
    expect(pickRandomSample([], 3, fixedRandom(0))).toEqual([]);
  });
});
