import { describe, it, expect } from "vitest";
import { getScoreLabel, SCORE_LABELS } from "./scoreLabel";

/**
 * こうかラベル分類の仕様:
 * 最終評価点の値域 (0, 1-40, 41-79, 80-99) ごとに、対応する "こうか" ラベルへ分類する。
 */
describe("[クエスト] こうかラベル分類", () => {
  it.each([
    [99, SCORE_LABELS.superEffective],
    [80, SCORE_LABELS.superEffective],
    [40, SCORE_LABELS.notVeryEffective],
    [1, SCORE_LABELS.notVeryEffective],
    [0, SCORE_LABELS.noEffect],
  ])("最終評価点 %i のとき『%s』と表示される", (score, label) => {
    expect(getScoreLabel(score)).toBe(label);
  });

  it.each([79, 41])("最終評価点 %i は通常帯でラベルを返さない", (score) => {
    expect(getScoreLabel(score)).toBeNull();
  });
});
