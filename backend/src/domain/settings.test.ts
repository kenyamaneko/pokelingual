import { describe, it, expect } from "vitest";
import { validateExcludedPokemonIDs } from "./settings.js";

// 実データの仕様変更でテストが壊れないよう、本番の ID/上限ではなくダミー値を使う。
const MAX_ID = 10;
const MAX_COUNT = 3;

describe("除外ポケモン設定の検証", () => {
  it("重複を含む有効な ID を保存すると、重複が除かれ昇順で受理される", () => {
    expect(validateExcludedPokemonIDs([3, 1, 3, 2], MAX_ID, MAX_COUNT)).toEqual({ ok: true, ids: [1, 2, 3] });
  });

  it("空配列を渡すと、除外なしとして成功する", () => {
    expect(validateExcludedPokemonIDs([], MAX_ID, MAX_COUNT)).toEqual({ ok: true, ids: [] });
  });

  it("配列でなければ失敗する", () => {
    expect(validateExcludedPokemonIDs("x", MAX_ID, MAX_COUNT).ok).toBe(false);
  });

  it("undefined でも失敗する (リクエストボディ欠落)", () => {
    expect(validateExcludedPokemonIDs(undefined, MAX_ID, MAX_COUNT).ok).toBe(false);
  });

  it("下限: 0 は失敗、1 は成功", () => {
    expect(validateExcludedPokemonIDs([0], MAX_ID, MAX_COUNT).ok).toBe(false);
    expect(validateExcludedPokemonIDs([1], MAX_ID, MAX_COUNT).ok).toBe(true);
  });

  it("上限: 10 は成功、11 は失敗", () => {
    expect(validateExcludedPokemonIDs([MAX_ID], MAX_ID, MAX_COUNT).ok).toBe(true);
    expect(validateExcludedPokemonIDs([MAX_ID + 1], MAX_ID, MAX_COUNT).ok).toBe(false);
  });

  it("非整数は失敗する", () => {
    expect(validateExcludedPokemonIDs([1.5], MAX_ID, MAX_COUNT).ok).toBe(false);
  });

  it("件数が上限ちょうどのとき、成功する", () => {
    expect(validateExcludedPokemonIDs([1, 2, 3], MAX_ID, MAX_COUNT).ok).toBe(true);
  });

  it("件数が上限を超えると失敗する", () => {
    expect(validateExcludedPokemonIDs([1, 2, 3, 4], MAX_ID, MAX_COUNT).ok).toBe(false);
  });

  it("重複を除いた件数が上限以内なら、成功する", () => {
    expect(validateExcludedPokemonIDs([1, 1, 2, 2, 3, 3], MAX_ID, MAX_COUNT)).toEqual({ ok: true, ids: [1, 2, 3] });
  });
});
