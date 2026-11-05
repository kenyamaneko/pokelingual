import { describe, it, expect } from "vitest";
import { buildExcludedPokemonIDs } from "./exclusion.js";

describe("[本体:出題]出題除外の決定", () => {
  describe("単体テスト", () => {
    describe("正常系", () => {
      it("ユーザーが除外ポケモンを設定していないとき、除外ポケモンの一覧は空になる", () => {
        expect(buildExcludedPokemonIDs(null)).toEqual(new Set());
      });

      it("ユーザーが除外ポケモンを 0 匹で設定したとき、除外ポケモンの一覧は空になる", () => {
        expect(buildExcludedPokemonIDs([])).toEqual(new Set());
      });

      it("ユーザーが図鑑番号 10 のポケモンだけを除外に設定したとき、除外ポケモンの一覧は図鑑番号 10 だけになる", () => {
        expect(buildExcludedPokemonIDs([10])).toEqual(new Set([10]));
      });

      it("ユーザーが図鑑番号 10 と 20 のポケモンを除外に設定したとき、除外ポケモンの一覧は図鑑番号 10 と 20 になる", () => {
        expect(buildExcludedPokemonIDs([10, 20])).toEqual(new Set([10, 20]));
      });
    });
  });
});
