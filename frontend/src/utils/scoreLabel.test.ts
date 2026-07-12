import { describe, it, expect } from "vitest";
import { getScoreLabel, SCORE_LABELS } from "./scoreLabel";

/**
 * こうかラベル分類の仕様:
 * スコアの値域 (0, 1-40, 41-79, 80-99, 100) ごとに、対応する "こうか" ラベルへ分類する。
 */
describe("こうかラベル分類", () => {
  it.each([
    [100, SCORE_LABELS.critical],
    [99, SCORE_LABELS.superEffective],
    [80, SCORE_LABELS.superEffective],
    [40, SCORE_LABELS.notVeryEffective],
    [1, SCORE_LABELS.notVeryEffective],
    [0, SCORE_LABELS.noEffect],
  ])("スコア %i のとき『%s』と表示される", (score, label) => {
    expect(getScoreLabel(score)).toBe(label);
  });

  it.each([79, 41])("スコア %i は通常帯でラベルを返さない", (score) => {
    expect(getScoreLabel(score)).toBeNull();
  });
});
