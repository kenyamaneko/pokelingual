/** スコア帯ごとのラベル切り替え閾値。0〜100 をポケモン技の "こうか" メッセージにマップする。 */
const SCORE_LABEL_THRESHOLDS = {
  critical: 100,
  superEffective: 80,
  noLabelAbove: 41,
  notVeryEffective: 1,
} as const;

/**
 * スコア帯ラベル文言。仕様文字列としてテストから参照されるため export する。
 * 文言変更時は実装とテストが同時に追従する。
 */
export const SCORE_LABELS = {
  critical: "いちげきひっさつ！",
  superEffective: "効果は　バツグンだ！",
  notVeryEffective: "効果は　いまひとつのようだ",
  noEffect: "効果が　ないみたいだ...",
} as const;

/**
 * スコア帯に応じた "こうか" ラベルを返す。
 * @param score 採点スコア。
 * @returns スコア帯のラベル。通常帯では null。
 */
export function getScoreLabel(score: number): string | null {
  if (score >= SCORE_LABEL_THRESHOLDS.critical) return SCORE_LABELS.critical;
  if (score >= SCORE_LABEL_THRESHOLDS.superEffective) return SCORE_LABELS.superEffective;
  if (score >= SCORE_LABEL_THRESHOLDS.noLabelAbove) return null;
  if (score >= SCORE_LABEL_THRESHOLDS.notVeryEffective) return SCORE_LABELS.notVeryEffective;
  return SCORE_LABELS.noEffect;
}
