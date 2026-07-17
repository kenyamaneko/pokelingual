import { describe, it, expect } from "vitest";
import { validateExcludedPokemonIDs } from "./settings.js";

// 実データの仕様変更でテストが壊れないよう、本番の図鑑番号ではなくダミー値を使う。
// メンバーシップ判定 (上限比較でない) を確かめるため、連続しない番号にして途中の欠番を作る。
const SERVABLE_IDS = new Set([1, 4, 7, 25, 150]);
const MAX_COUNT = 3;

describe("[設定] 除外ポケモン設定の検証", () => {
  it("重複を含む供給可能な ID を保存すると、重複が除かれ昇順で受理される", () => {
    expect(validateExcludedPokemonIDs([7, 1, 7, 4], SERVABLE_IDS, MAX_COUNT)).toEqual({ ok: true, ids: [1, 4, 7] });
  });

  it("空配列を渡すと、除外なしとして成功する", () => {
    expect(validateExcludedPokemonIDs([], SERVABLE_IDS, MAX_COUNT)).toEqual({ ok: true, ids: [] });
  });

  it("配列でなければ失敗する", () => {
    expect(validateExcludedPokemonIDs("x", SERVABLE_IDS, MAX_COUNT).ok).toBe(false);
  });

  it("undefined でも失敗する (リクエストボディ欠落)", () => {
    expect(validateExcludedPokemonIDs(undefined, SERVABLE_IDS, MAX_COUNT).ok).toBe(false);
  });

  it("供給リストにある図鑑番号は受理される", () => {
    expect(validateExcludedPokemonIDs([25], SERVABLE_IDS, MAX_COUNT).ok).toBe(true);
  });

  it("供給リストの最小と最大のあいだでも、欠番の図鑑番号は失敗する", () => {
    expect(validateExcludedPokemonIDs([5], SERVABLE_IDS, MAX_COUNT).ok).toBe(false);
  });

  it("非整数は失敗する", () => {
    expect(validateExcludedPokemonIDs([1.5], SERVABLE_IDS, MAX_COUNT).ok).toBe(false);
  });

  it("件数が上限ちょうどのとき、成功する", () => {
    expect(validateExcludedPokemonIDs([1, 4, 7], SERVABLE_IDS, MAX_COUNT).ok).toBe(true);
  });

  it("件数が上限を超えると失敗する", () => {
    expect(validateExcludedPokemonIDs([1, 4, 7, 25], SERVABLE_IDS, MAX_COUNT).ok).toBe(false);
  });

  it("重複を除いた件数が上限以内なら、成功する", () => {
    expect(validateExcludedPokemonIDs([1, 1, 4, 4, 7, 7], SERVABLE_IDS, MAX_COUNT)).toEqual({ ok: true, ids: [1, 4, 7] });
  });
});
