import { describe, it, expect } from "vitest";
import {
  generationsToPokemonIDs,
  buildQuestPoolIDs,
  validateEnabledGenerations,
} from "./generation.js";

// 世代範囲がクランプされない十分大きい上限。上限でのクランプ自体は専用テストで別に確かめる。
const NO_CLAMP_MAX = 898;

/**
 * 選択世代を図鑑番号の集合へ展開する仕様。世代境界 (151/152 など) は純関数の定義そのものなので具体値で確かめる。
 */
describe("generationsToPokemonIDs (選択世代→図鑑番号の集合)", () => {
  it("第1世代は 1〜151 を含み、隣の 152 は含まない", () => {
    const ids = generationsToPokemonIDs([1], NO_CLAMP_MAX);
    expect(ids.size).toBe(151);
    expect(ids.has(1)).toBe(true);
    expect(ids.has(151)).toBe(true);
    expect(ids.has(152)).toBe(false);
  });

  it("第2世代は 152〜251 を含み、両隣の 151・252 は含まない", () => {
    const ids = generationsToPokemonIDs([2], NO_CLAMP_MAX);
    expect(ids.has(152)).toBe(true);
    expect(ids.has(251)).toBe(true);
    expect(ids.has(151)).toBe(false);
    expect(ids.has(252)).toBe(false);
  });

  it("選んでいない世代の番号は含まれない (第3世代のみ選ぶと第1世代は入らない)", () => {
    const ids = generationsToPokemonIDs([3], NO_CLAMP_MAX);
    expect(ids.has(252)).toBe(true);
    expect(ids.has(1)).toBe(false);
    expect(ids.has(151)).toBe(false);
  });

  it("飛び石の世代選択 (第2・第4世代) は間の第3世代を含まない", () => {
    const ids = generationsToPokemonIDs([2, 4], NO_CLAMP_MAX);
    expect(ids.has(200)).toBe(true);
    expect(ids.has(400)).toBe(true);
    expect(ids.has(300)).toBe(false);
  });

  it("maxPokemonID を超える番号は含まれない (上限でクランプする)", () => {
    const ids = generationsToPokemonIDs([1], 100);
    expect(ids.size).toBe(100);
    expect(ids.has(100)).toBe(true);
    expect(ids.has(101)).toBe(false);
  });

  it("世代が空なら空集合になる", () => {
    expect(generationsToPokemonIDs([], NO_CLAMP_MAX).size).toBe(0);
  });
});

/**
 * 出題プール = 選択世代の展開から除外 ID を差し引いたもの。
 */
describe("buildQuestPoolIDs (出題プールの図鑑番号)", () => {
  it("除外 ID がプールから取り除かれる", () => {
    const pool = buildQuestPoolIDs([1], NO_CLAMP_MAX, new Set([5, 10]));
    expect(pool.size).toBe(149);
    expect(pool.has(5)).toBe(false);
    expect(pool.has(10)).toBe(false);
    expect(pool.has(1)).toBe(true);
  });

  it("選択世代の外にある除外 ID はプールの大きさに影響しない", () => {
    const pool = buildQuestPoolIDs([1], NO_CLAMP_MAX, new Set([200]));
    expect(pool.size).toBe(151);
  });

  it("選択世代の全 ID が除外されると空になる", () => {
    const pool = buildQuestPoolIDs([1], 3, new Set([1, 2, 3]));
    expect(pool.size).toBe(0);
  });
});

/**
 * 世代リストのバリデーション仕様。純関数なので具体値で直接確かめる。
 * 空配列・不正値の経路は設定画面 (チェックボックス・最低1世代) で塞がれるが、API 境界の防御として backend でも弾く。
 */
describe("validateEnabledGenerations", () => {
  it("有効な世代を重複排除・昇順で返す", () => {
    expect(validateEnabledGenerations([3, 1, 1])).toEqual({ ok: true, generations: [1, 3] });
  });

  it("空配列は失敗する (画面の最低1世代バリデーションが本来防ぐが、防御的に弾く)", () => {
    expect(validateEnabledGenerations([]).ok).toBe(false);
  });

  it("配列でなければ失敗する", () => {
    expect(validateEnabledGenerations("x").ok).toBe(false);
  });

  it("undefined でも失敗する (リクエストボディ欠落)", () => {
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

  it("整数でない世代番号は失敗する", () => {
    expect(validateEnabledGenerations([1.5]).ok).toBe(false);
  });
});
