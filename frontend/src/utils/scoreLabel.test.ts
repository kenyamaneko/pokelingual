import { describe, it, expect } from "vitest";
import { getScoreLabel, SCORE_LABELS } from "./scoreLabel";

/**
 * こうかラベル分類の仕様:
 * スコアの値域 (0, 1-40, 41-79, 80-99, 100) ごとに、対応する "こうか" ラベルへ分類する。
 */
describe("こうかラベル分類", () => {
  it.each([
    { score: 100, label: SCORE_LABELS.critical },
    { score: 99, label: SCORE_LABELS.superEffective },
    { score: 80, label: SCORE_LABELS.superEffective },
    { score: 40, label: SCORE_LABELS.notVeryEffective },
    { score: 1, label: SCORE_LABELS.notVeryEffective },
    { score: 0, label: SCORE_LABELS.noEffect },
  ])("score=$score のとき $label を返す", ({ score, label }) => {
    expect(getScoreLabel(score)).toBe(label);
  });

  it.each([79, 41])("score=%i は通常帯でラベルを返さない", (score) => {
    expect(getScoreLabel(score)).toBeNull();
  });
});
