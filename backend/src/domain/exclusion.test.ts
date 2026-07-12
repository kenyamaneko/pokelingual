import { describe, it, expect } from "vitest";
import { buildExcludedPokemonIDs } from "./exclusion.js";

/**
 * 出題・図鑑から除外するポケモン ID 集合の仕様:
 * - ユーザー設定による除外は全環境で適用する
 * - 開発者除外 (固定 6 匹) は prod 以外の環境でのみ合成する
 */
describe("出題除外の決定", () => {
  // 開発者除外の 6 匹 (exclusion.ts の固定リストが仕様なので具体値で確かめる)
  const DEVELOPER_EXCLUDED = [167, 168, 595, 596, 751, 752];

  describe("prod 環境", () => {
    it("ユーザー設定が無ければ何も除外しない", () => {
      expect(buildExcludedPokemonIDs("prod", null)).toEqual(new Set());
    });

    it("ユーザー設定が空でも何も除外しない", () => {
      expect(buildExcludedPokemonIDs("prod", [])).toEqual(new Set());
    });

    it("ユーザー設定による除外があるとき、開発者除外を合成せずそれだけを適用する", () => {
      expect(buildExcludedPokemonIDs("prod", [10, 20])).toEqual(new Set([10, 20]));
    });
  });

  describe.each(["local", "dev"] as const)("%s 環境", (environment) => {
    it("ユーザー設定が無ければ開発者除外の 6 匹だけを除外する", () => {
      expect(buildExcludedPokemonIDs(environment, null)).toEqual(new Set(DEVELOPER_EXCLUDED));
    });

    it("ユーザー設定が空でも開発者除外は適用する", () => {
      expect(buildExcludedPokemonIDs(environment, [])).toEqual(new Set(DEVELOPER_EXCLUDED));
    });

    it("ユーザー設定による除外が 1 件のとき、開発者除外と合成される", () => {
      expect(buildExcludedPokemonIDs(environment, [10])).toEqual(
        new Set([10, ...DEVELOPER_EXCLUDED]),
      );
    });

    it("ユーザー設定による除外が複数件のとき、開発者除外と合成される", () => {
      expect(buildExcludedPokemonIDs(environment, [10, 20])).toEqual(
        new Set([10, 20, ...DEVELOPER_EXCLUDED]),
      );
    });

    it("ユーザー設定が開発者除外と重複しても集合として一つにまとまる", () => {
      expect(buildExcludedPokemonIDs(environment, [167, 10])).toEqual(
        new Set([10, ...DEVELOPER_EXCLUDED]),
      );
    });
  });
});
