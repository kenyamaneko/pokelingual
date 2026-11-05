import { describe, it, expect } from "vitest";
import {
  formatPokemonId,
  formatHeightMeters,
  formatWeightKilograms,
} from "./pokemonFormat";

describe("[本体:図鑑]図鑑番号の表示形式", () => {
  describe("単体テスト", () => {
    describe("正常系", () => {
      it.each([
        [9, "009"],
        [10, "010"],
        [99, "099"],
        [100, "100"],
        [999, "999"],
        [1000, "1000"],
      ])("図鑑番号が %i のとき、表示は「%s」になる", (id, expected) => {
        expect(formatPokemonId(id)).toBe(expected);
      });
    });
  });
});

describe("[本体:図鑑]高さの表示形式", () => {
  describe("単体テスト", () => {
    describe("正常系", () => {
      it("高さが 4 デシメートルのとき、メートルで表した表示は「0.4」になる", () => {
        expect(formatHeightMeters(4)).toBe("0.4");
      });

      it("高さが 10 デシメートルのとき、メートルで表した表示は「1.0」になる", () => {
        expect(formatHeightMeters(10)).toBe("1.0");
      });

      it("高さが 20 デシメートルのとき、メートルで表した表示は「2.0」になる", () => {
        expect(formatHeightMeters(20)).toBe("2.0");
      });
    });
  });
});

describe("[本体:図鑑]重さの表示形式", () => {
  describe("単体テスト", () => {
    describe("正常系", () => {
      it("重さが 60 ヘクトグラムのとき、キログラムで表した表示は「6.0」になる", () => {
        expect(formatWeightKilograms(60)).toBe("6.0");
      });

      it("重さが 5 ヘクトグラムのとき、キログラムで表した表示は「0.5」になる", () => {
        expect(formatWeightKilograms(5)).toBe("0.5");
      });

      it("重さが 1220 ヘクトグラムのとき、キログラムで表した表示は「122.0」になる", () => {
        expect(formatWeightKilograms(1220)).toBe("122.0");
      });
    });
  });
});
