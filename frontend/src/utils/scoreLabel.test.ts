import { describe, expect } from "vitest";
import { getScoreLabel } from "./scoreLabel";
import { defineCase } from "../test/defineCase";

const GET_LABEL = "『こうか』ラベルを取得する";

describe("[本体:クエスト]最終評価点に応じた『こうか』ラベル", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["境界値"],
      steps: [
        {
          Given: "最終評価点が 80 のとき",
          When: [GET_LABEL],
          Then: "『こうか』ラベルは『効果は　バツグンだ！』になる",
        },
      ],
    },
    () => {
      expect(getScoreLabel(80)).toBe("効果は　バツグンだ！");
    },
  );

  for (const score of [40, 1]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        観点: ["境界値"],
        steps: [
          {
            Given: `最終評価点が ${score} のとき`,
            When: [GET_LABEL],
            Then: "『こうか』ラベルは『効果は　いまひとつのようだ』になる",
          },
        ],
      },
      () => {
        expect(getScoreLabel(score)).toBe("効果は　いまひとつのようだ");
      },
    );
  }

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["境界値"],
      steps: [
        {
          Given: "最終評価点が 0 のとき",
          When: [GET_LABEL],
          Then: "『こうか』ラベルは『効果が　ないみたいだ...』になる",
        },
      ],
    },
    () => {
      expect(getScoreLabel(0)).toBe("効果が　ないみたいだ...");
    },
  );

  for (const score of [79, 41]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        観点: ["境界値"],
        steps: [
          {
            Given: `最終評価点が ${score} のとき`,
            When: [GET_LABEL],
            Then: "『こうか』ラベルは無しになる",
          },
        ],
      },
      () => {
        expect(getScoreLabel(score)).toBeNull();
      },
    );
  }
});
