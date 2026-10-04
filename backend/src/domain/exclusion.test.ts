import { describe, it, expect } from "vitest";
import { buildExcludedPokemonIDs } from "./exclusion.js";

describe("[出題] 出題除外の決定", () => {
  describe("正常系", () => {
    it("ユーザーが除外するポケモンを設定していないとき、除外するポケモンの集合は空になる", () => {
      expect(buildExcludedPokemonIDs(null)).toEqual(new Set());
    });

    it("ユーザーが複数のポケモンを除外に設定したとき、除外するポケモンの集合は設定した図鑑番号と同じになる", () => {
      expect(buildExcludedPokemonIDs([10, 20])).toEqual(new Set([10, 20]));
    });
  });
});
