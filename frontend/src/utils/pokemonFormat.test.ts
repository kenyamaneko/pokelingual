import { describe, expect } from "vitest";
import {
  formatPokemonId,
  formatHeightMeters,
  formatWeightKilograms,
} from "./pokemonFormat";
import { defineCase } from "../test/defineCase";

describe("[本体:図鑑]図鑑番号の表示形式", () => {
  for (const [id, expected] of [
    [9, "009"],
    [10, "010"],
    [99, "099"],
    [100, "100"],
    [999, "999"],
    [1000, "1000"],
  ] as const) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        steps: [{ Given: `図鑑番号が ${id} のとき`, When: ["図鑑番号を表示する"], Then: `表示は「${expected}」になる` }],
      },
      () => {
        expect(formatPokemonId(id)).toBe(expected);
      },
    );
  }
});

describe("[本体:図鑑]高さの表示形式", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        { Given: "高さが 4 デシメートルのとき", When: ["高さを表示する"], Then: "メートルで表した表示は「0.4」になる" },
      ],
    },
    () => {
      expect(formatHeightMeters(4)).toBe("0.4");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        { Given: "高さが 10 デシメートルのとき", When: ["高さを表示する"], Then: "メートルで表した表示は「1.0」になる" },
      ],
    },
    () => {
      expect(formatHeightMeters(10)).toBe("1.0");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        { Given: "高さが 20 デシメートルのとき", When: ["高さを表示する"], Then: "メートルで表した表示は「2.0」になる" },
      ],
    },
    () => {
      expect(formatHeightMeters(20)).toBe("2.0");
    },
  );
});

describe("[本体:図鑑]重さの表示形式", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        { Given: "重さが 60 ヘクトグラムのとき", When: ["重さを表示する"], Then: "キログラムで表した表示は「6.0」になる" },
      ],
    },
    () => {
      expect(formatWeightKilograms(60)).toBe("6.0");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        { Given: "重さが 5 ヘクトグラムのとき", When: ["重さを表示する"], Then: "キログラムで表した表示は「0.5」になる" },
      ],
    },
    () => {
      expect(formatWeightKilograms(5)).toBe("0.5");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "重さが 1220 ヘクトグラムのとき",
          When: ["重さを表示する"],
          Then: "キログラムで表した表示は「122.0」になる",
        },
      ],
    },
    () => {
      expect(formatWeightKilograms(1220)).toBe("122.0");
    },
  );
});
