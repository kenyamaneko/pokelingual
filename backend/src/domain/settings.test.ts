import { describe, it, expect } from "vitest";
import { validateExcludedPokemonIDs } from "./settings.js";

const SERVABLE_IDS = new Set([1, 4, 7, 25, 150]);
const MAX_COUNT = 3;

describe("[設定] 除外ポケモン設定の検証", () => {
  describe("正常系", () => {
    it("出題可能な図鑑番号 7・1・7・4 を指定したとき、重複が除かれ 1・4・7 の昇順で受理される", () => {
      expect(validateExcludedPokemonIDs([7, 1, 7, 4], SERVABLE_IDS, MAX_COUNT)).toEqual({ ok: true, ids: [1, 4, 7] });
    });

    it("除外する図鑑番号の一覧が空のとき、除外なしとして受理される", () => {
      expect(validateExcludedPokemonIDs([], SERVABLE_IDS, MAX_COUNT)).toEqual({ ok: true, ids: [] });
    });

    it.each([
      ["出題可能な図鑑番号 25 を 1 件だけ指定した", [25]],
      ["出題可能な図鑑番号を上限と同じ件数だけ指定した", [1, 4, 7]],
    ])("%sとき、受理される", (_label, raw) => {
      expect(validateExcludedPokemonIDs(raw, SERVABLE_IDS, MAX_COUNT).ok).toBe(true);
    });

    it("重複を含めると上限を超える件数でも、重複を除いた件数が上限以内のとき、重複が除かれて受理される", () => {
      expect(validateExcludedPokemonIDs([1, 1, 4, 4, 7, 7], SERVABLE_IDS, MAX_COUNT)).toEqual({ ok: true, ids: [1, 4, 7] });
    });
  });

  describe("異常系", () => {
    it.each([
      ["除外する図鑑番号の指定が一覧でなく文字列の", "x"],
      ["除外する図鑑番号の指定がリクエストの本文に無い", undefined],
    ])("%sとき、除外する図鑑番号は一覧で指定する必要があるという理由で検証に失敗する", (_label, raw) => {
      expect(validateExcludedPokemonIDs(raw, SERVABLE_IDS, MAX_COUNT)).toEqual({
        ok: false,
        message: "excluded_pokemon_ids must be an array",
      });
    });

    it.each([
      ["出題可能な図鑑番号の最小と最大のあいだにある欠番 5 を指定した", [5], "pokemon id not in pokedex: 5"],
      ["整数でない 1.5 を指定した", [1.5], "pokemon id not in pokedex: 1.5"],
    ])("%sとき、出題可能な図鑑番号に無いという理由で検証に失敗する", (_label, raw, message) => {
      expect(validateExcludedPokemonIDs(raw, SERVABLE_IDS, MAX_COUNT)).toEqual({ ok: false, message });
    });

    it("指定した件数が上限を 1 件超えるとき、上限を超えているという理由で検証に失敗する", () => {
      expect(validateExcludedPokemonIDs([1, 4, 7, 25], SERVABLE_IDS, MAX_COUNT)).toEqual({
        ok: false,
        message: "excluded_pokemon_ids exceeds limit (max 3)",
      });
    });
  });
});
