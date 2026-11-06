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
          Given: "場所 ID が crystal-cave のとき",
          When: ["場所 ID から場所を探す"],
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
      steps: [
        {
          Given: "どの場所にも無い場所 ID no-such-place のとき",
          When: ["場所 ID から場所を探す"],
          Then: "対応する場所は無しになる",
        },
      ],
    },
    () => {
      expect(findLocation("no-such-place")).toBeUndefined();
    },
  );
});

const PICK_LOCATIONS = "場所を抽選する";

describe("[本体:クエスト]場所の抽選", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: "抽選する場所の数が 4 か所のとき", When: [PICK_LOCATIONS], Then: "選ばれる場所の数は 4 か所になる" }],
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
      steps: [{ Given: "抽選する場所の数が 4 か所のとき", When: [PICK_LOCATIONS], Then: "選ばれた場所に重複は無い" }],
    },
    () => {
      const picked = pickRandomLocations(fixedRandom(0), 4);
      expect(new Set(picked.map((l) => l.id)).size).toBe(4);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      steps: [{ Given: "抽選する場所の数が 0 か所のとき", When: [PICK_LOCATIONS], Then: "選ばれる場所の数は 0 か所になる" }],
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
      steps: [{ Given: "抽選する場所の数が 1 か所のとき", When: [PICK_LOCATIONS], Then: "選ばれる場所の数は 1 か所になる" }],
    },
    () => {
      const picked = pickRandomLocations(fixedRandom(0), 1);
      expect(picked).toHaveLength(1);
    },
  );

  for (const { 正常異常, given, count } of [
    {
      正常異常: "正常系" as const,
      given: "抽選する場所の数が、定義された場所の総数と同じ 10 か所のとき",
      count: 10,
    },
    {
      正常異常: "異常系" as const,
      given: "抽選する場所の数が、定義された場所の総数 10 か所より 1 か所多い 11 か所のとき",
      count: 11,
    },
  ]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常,
        steps: [{ Given: given, When: [PICK_LOCATIONS], Then: "選ばれる場所の数は 10 か所になる" }],
      },
      () => {
        const picked = pickRandomLocations(fixedRandom(0), count);
        expect(picked).toHaveLength(10);
      },
    );
  }
});
