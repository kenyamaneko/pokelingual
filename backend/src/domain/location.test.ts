import { describe, expect } from "vitest";
import {
  findLocation,
  pickRandomLocations,
} from "./location.js";
import type { RandomSource } from "./ports.js";
import { defineCase } from "../test/defineCase.js";

function fixedRandom(value: number): RandomSource {
  return { next: () => value };
}

describe("[本体:クエスト]場所 ID に対応する場所", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          When: ["場所 ID「crystal-cave」を指定して、場所を探す"],
          Then: "対応する場所の名前はきらめく水晶の洞窟になる",
        },
      ],
    },
    () => {
      expect(findLocation("crystal-cave")?.name).toBe("きらめく水晶の洞窟");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      観点: ["エッジケース"],
      steps: [
        {
          When: ["場所 ID「no-such-place」を指定して、場所を探す"],
          Then: "対応する場所は無しになる",
        },
      ],
    },
    () => {
      expect(findLocation("no-such-place")).toBeUndefined();
    },
  );
});

function drawLocations(count: number): string {
  return `場所を ${count} か所抽選する`;
}

const TOTAL_LOCATIONS_10 = "場所が全部で 10 か所定義されているとき";

describe("[本体:クエスト]場所の抽選", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["件数・有無"],
      steps: [{ When: [drawLocations(4)], Then: "選ばれる場所の数は 4 か所になる" }],
    },
    () => {
      const picked = pickRandomLocations(fixedRandom(0), 4);
      expect(picked).toHaveLength(4);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["件数・有無"],
      steps: [{ When: [drawLocations(4)], Then: "選ばれた場所に重複は無い" }],
    },
    () => {
      const picked = pickRandomLocations(fixedRandom(0), 4);
      expect(new Set(picked.map((l) => l.id)).size).toBe(4);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["件数・有無"],
      steps: [{ When: [drawLocations(0)], Then: "選ばれる場所の数は 0 か所になる" }],
    },
    () => {
      const picked = pickRandomLocations(fixedRandom(0), 0);
      expect(picked).toHaveLength(0);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["件数・有無"],
      steps: [{ When: [drawLocations(1)], Then: "選ばれる場所の数は 1 か所になる" }],
    },
    () => {
      const picked = pickRandomLocations(fixedRandom(0), 1);
      expect(picked).toHaveLength(1);
    },
  );

  for (const count of [10, 11]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        観点: ["境界値"],
        steps: [{ Given: TOTAL_LOCATIONS_10, When: [drawLocations(count)], Then: "選ばれる場所の数は 10 か所になる" }],
      },
      () => {
        const picked = pickRandomLocations(fixedRandom(0), count);
        expect(picked).toHaveLength(10);
      },
    );
  }
});
