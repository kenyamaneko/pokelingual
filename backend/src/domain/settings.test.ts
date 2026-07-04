import { describe, it, expect } from "vitest";
import { validateExcludedPokemonIDs } from "./settings.js";

// 実データの仕様変更でテストが壊れないよう、本番の ID/上限ではなくダミー値を使う。
const MAX_ID = 10;
const MAX_COUNT = 3;

describe("validateExcludedPokemonIDs", () => {
  it("有効な ID を重複排除・昇順で返す", () => {
    expect(validateExcludedPokemonIDs([3, 1, 3, 2], MAX_ID, MAX_COUNT)).toEqual({ ok: true, ids: [1, 2, 3] });
  });

  it("空配列は成功 (除外なし)", () => {
    expect(validateExcludedPokemonIDs([], MAX_ID, MAX_COUNT)).toEqual({ ok: true, ids: [] });
  });

  it("配列でなければ失敗", () => {
    expect(validateExcludedPokemonIDs("x", MAX_ID, MAX_COUNT).ok).toBe(false);
  });

  it("undefined でも失敗 (リクエストボディ欠落)", () => {
    expect(validateExcludedPokemonIDs(undefined, MAX_ID, MAX_COUNT).ok).toBe(false);
  });

  it("下限: 0 は失敗、1 は成功", () => {
    expect(validateExcludedPokemonIDs([0], MAX_ID, MAX_COUNT).ok).toBe(false);
    expect(validateExcludedPokemonIDs([1], MAX_ID, MAX_COUNT).ok).toBe(true);
  });

  it("上限: maxPokemonID は成功、+1 は失敗", () => {
    expect(validateExcludedPokemonIDs([MAX_ID], MAX_ID, MAX_COUNT).ok).toBe(true);
    expect(validateExcludedPokemonIDs([MAX_ID + 1], MAX_ID, MAX_COUNT).ok).toBe(false);
  });

  it("非整数は失敗", () => {
    expect(validateExcludedPokemonIDs([1.5], MAX_ID, MAX_COUNT).ok).toBe(false);
  });

  it("件数が上限ちょうどは成功", () => {
    expect(validateExcludedPokemonIDs([1, 2, 3], MAX_ID, MAX_COUNT).ok).toBe(true);
  });

  it("件数が上限を超えると失敗", () => {
    expect(validateExcludedPokemonIDs([1, 2, 3, 4], MAX_ID, MAX_COUNT).ok).toBe(false);
  });

  it("重複排除後に上限以内なら成功", () => {
    expect(validateExcludedPokemonIDs([1, 1, 2, 2, 3, 3], MAX_ID, MAX_COUNT)).toEqual({ ok: true, ids: [1, 2, 3] });
  });
});
