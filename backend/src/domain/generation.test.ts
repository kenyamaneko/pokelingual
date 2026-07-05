import { describe, it, expect } from "vitest";
import {
  generationsToPokemonIDs,
  buildQuestPoolIDs,
  validateEnabledGenerations,
} from "./generation.js";

// 図鑑番号上限のダミー値。実運用の 898 とは独立に境界を確かめる。
const MAX_ID = 898;

/**
 * 選択世代を図鑑番号の集合へ展開する仕様。世代境界 (151/152 など) は純関数の定義そのものなので具体値で確かめる。
 */
describe("generationsToPokemonIDs (選択世代→図鑑番号の集合)", () => {
  it("第1世代は 1〜151 を含み 152 を含まない", () => {
    const ids = generationsToPokemonIDs([1], MAX_ID);
    expect(ids.size).toBe(151);
    expect(ids.has(1)).toBe(true);
    expect(ids.has(151)).toBe(true);
    expect(ids.has(152)).toBe(false);
  });

  it("第2世代は 152〜251 を含み、第1世代の 151 は含まない", () => {
    const ids = generationsToPokemonIDs([2], MAX_ID);
    expect(ids.has(152)).toBe(true);
    expect(ids.has(251)).toBe(true);
    expect(ids.has(151)).toBe(false);
    expect(ids.has(252)).toBe(false);
  });

  it("複数世代を選ぶと双方の範囲を含む", () => {
    const ids = generationsToPokemonIDs([1, 2], MAX_ID);
    expect(ids.size).toBe(251);
    expect(ids.has(1)).toBe(true);
    expect(ids.has(251)).toBe(true);
  });

  it("上限より上の図鑑番号は切り捨てられる", () => {
    const ids = generationsToPokemonIDs([1], 100);
    expect(ids.size).toBe(100);
    expect(ids.has(100)).toBe(true);
    expect(ids.has(101)).toBe(false);
  });

  it("選ばれていない世代の図鑑番号は含まれない", () => {
    const ids = generationsToPokemonIDs([3], MAX_ID);
    expect(ids.has(1)).toBe(false);
    expect(ids.has(252)).toBe(true);
  });

  it("世代が空なら空集合になる", () => {
    expect(generationsToPokemonIDs([], MAX_ID).size).toBe(0);
  });
});

/**
 * 出題プール = 選択世代の展開から除外 ID を差し引いたもの。
 */
describe("buildQuestPoolIDs (出題プールの図鑑番号)", () => {
  it("除外 ID がプールから取り除かれる", () => {
    const pool = buildQuestPoolIDs([1], MAX_ID, new Set([5, 10]));
    expect(pool.size).toBe(149);
    expect(pool.has(5)).toBe(false);
    expect(pool.has(10)).toBe(false);
    expect(pool.has(1)).toBe(true);
  });

  it("選択世代の外にある除外 ID はプールの大きさに影響しない", () => {
    const pool = buildQuestPoolIDs([1], MAX_ID, new Set([200]));
    expect(pool.size).toBe(151);
  });

  it("選択世代の全 ID が除外されると空になる", () => {
    const pool = buildQuestPoolIDs([1], 3, new Set([1, 2, 3]));
    expect(pool.size).toBe(0);
  });
});

/**
 * 世代リストのバリデーション仕様。純関数なので具体値で直接確かめる。
 */
describe("validateEnabledGenerations", () => {
  it("有効な世代を重複排除・昇順で返す", () => {
    expect(validateEnabledGenerations([3, 1, 1])).toEqual({ ok: true, generations: [1, 3] });
  });

  it("空配列は失敗 (最低1世代必須)", () => {
    expect(validateEnabledGenerations([]).ok).toBe(false);
  });

  it("配列でなければ失敗", () => {
    expect(validateEnabledGenerations("x").ok).toBe(false);
  });

  it("undefined でも失敗 (リクエストボディ欠落)", () => {
    expect(validateEnabledGenerations(undefined).ok).toBe(false);
  });

  it("下限: 0 は失敗、1 は成功", () => {
    expect(validateEnabledGenerations([0]).ok).toBe(false);
    expect(validateEnabledGenerations([1]).ok).toBe(true);
  });

  it("上限: 8 は成功、9 は失敗", () => {
    expect(validateEnabledGenerations([8]).ok).toBe(true);
    expect(validateEnabledGenerations([9]).ok).toBe(false);
  });

  it("非整数は失敗", () => {
    expect(validateEnabledGenerations([1.5]).ok).toBe(false);
  });
});
