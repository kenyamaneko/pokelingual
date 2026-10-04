import { describe, it, expect } from "vitest";
import {
  formatPokemonId,
  formatHeightMeters,
  formatWeightKilograms,
} from "./pokemonFormat";

describe("[図鑑] 図鑑番号の表示形式", () => {
  describe("正常系", () => {
    it.each([
      [1, "001"],
      [25, "025"],
      [150, "150"],
      [999, "999"],
      [1000, "1000"],
    ])("図鑑番号が %i のとき、%s と表示される", (id, expected) => {
      expect(formatPokemonId(id)).toBe(expected);
    });
  });
});

describe("[図鑑] 高さの表示形式", () => {
  describe("正常系", () => {
    it.each([
      [4, "0.4"],
      [10, "1.0"],
      [20, "2.0"],
    ])("高さが %i デシメートルのとき、%s m と表示される", (decimeters, expected) => {
      expect(formatHeightMeters(decimeters)).toBe(expected);
    });
  });
});

describe("[図鑑] 重さの表示形式", () => {
  describe("正常系", () => {
    it.each([
      [60, "6.0"],
      [5, "0.5"],
      [1220, "122.0"],
    ])("重さが %i ヘクトグラムのとき、%s kg と表示される", (hectograms, expected) => {
      expect(formatWeightKilograms(hectograms)).toBe(expected);
    });
  });
});
