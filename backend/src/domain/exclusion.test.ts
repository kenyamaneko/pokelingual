import { describe, it, expect } from "vitest";
import { resolveDevExcludedPokemonIDs, buildExcludedPokemonIDs } from "./exclusion.js";

/**
 * 除外ロジックの仕様:
 * - 開発者除外は prod では無効 (空)、それ以外の環境では有効 (非空)
 * - 実効除外は per-user 除外と開発者除外の和集合
 */
describe("resolveDevExcludedPokemonIDs", () => {
  it("prod では空を返す", () => {
    expect(resolveDevExcludedPokemonIDs("prod")).toEqual([]);
  });

  // prod 以外 (境界の両側を含む) では有効。具体的な ID は仕様に埋め込まず、非空であることだけ確かめる。
  it.each(["local", "dev", "stg"])("%s では有効な除外リストを返す (非空)", (env) => {
    expect(resolveDevExcludedPokemonIDs(env).length).toBeGreaterThan(0);
  });

  it("prod と非prod で結果が異なる", () => {
    expect(resolveDevExcludedPokemonIDs("prod")).not.toEqual(resolveDevExcludedPokemonIDs("dev"));
  });
});

describe("buildExcludedPokemonIDs", () => {
  it("per-user と開発者除外を和集合にする", () => {
    const result = buildExcludedPokemonIDs([10, 20], [30, 40]);
    expect(result).toEqual(new Set([10, 20, 30, 40]));
  });

  it("per-user が null なら開発者除外のみ", () => {
    expect(buildExcludedPokemonIDs(null, [30, 40])).toEqual(new Set([30, 40]));
  });

  it("開発者除外が空なら per-user のみ", () => {
    expect(buildExcludedPokemonIDs([10, 20], [])).toEqual(new Set([10, 20]));
  });

  it("両方が空/null なら空集合", () => {
    expect(buildExcludedPokemonIDs(null, [])).toEqual(new Set());
  });

  it("重複する ID は集約される", () => {
    expect(buildExcludedPokemonIDs([10, 20], [20, 30])).toEqual(new Set([10, 20, 30]));
  });
});
