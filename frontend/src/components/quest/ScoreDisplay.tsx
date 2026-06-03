import type { ScoreResponse } from "../../../../shared/api-types/quest";

interface ScoreDisplayProps {
  score: ScoreResponse;
}

/** スコア最大値。HP バー (100 - score) の上限としても使う。 */
const MAX_SCORE = 100;

/** スコアに応じた色クラスを返すための閾値。 */
const SCORE_COLOR_THRESHOLDS = {
  green: 90,
  blue: 70,
  yellow: 50,
  orange: 30,
} as const;

/** HP バーの色を切り替える残 HP の閾値。 */
const HP_BAR_THRESHOLDS = {
  green: 50,
  yellow: 20,
} as const;

/** スコア帯ごとのラベル切り替え閾値。0〜MAX_SCORE をポケモン技の "こうか" メッセージにマップする。 */
const SCORE_LABEL_THRESHOLDS = {
  critical: 100,
  superEffective: 80,
  noLabelAbove: 41,
  notVeryEffective: 1,
} as const;

function getScoreColor(score: number): string {
  if (score >= SCORE_COLOR_THRESHOLDS.green) return "text-green-600";
  if (score >= SCORE_COLOR_THRESHOLDS.blue) return "text-blue-600";
  if (score >= SCORE_COLOR_THRESHOLDS.yellow) return "text-yellow-600";
  if (score >= SCORE_COLOR_THRESHOLDS.orange) return "text-orange-600";
  return "text-red-600";
}

function getHPBarColor(remainingHP: number): string {
  if (remainingHP > HP_BAR_THRESHOLDS.green) return "bg-green-500";
  if (remainingHP > HP_BAR_THRESHOLDS.yellow) return "bg-yellow-500";
  return "bg-red-500";
}

/**
 * スコア帯ラベル文言。仕様文字列としてテストから参照されるため export する。
 * 文言変更時は実装とテストが同時に追従する。
 */
export const SCORE_LABELS = {
  critical: "いちげき　ひっさつ！",
  superEffective: "こうかは　ばつぐんだ！",
  notVeryEffective: "こうかは　いまひとつの　ようだ",
  noEffect: "こうかが　ないみたいだ...",
} as const;

function getScoreLabel(score: number): string | null {
  if (score >= SCORE_LABEL_THRESHOLDS.critical) return SCORE_LABELS.critical;
  if (score >= SCORE_LABEL_THRESHOLDS.superEffective) return SCORE_LABELS.superEffective;
  if (score >= SCORE_LABEL_THRESHOLDS.noLabelAbove) return null;
  if (score >= SCORE_LABEL_THRESHOLDS.notVeryEffective) return SCORE_LABELS.notVeryEffective;
  return SCORE_LABELS.noEffect;
}

/** 採点結果をダメージ表現で表示する。HPバーとスコア帯のラベルを含む。 */
export function ScoreDisplay({ score }: ScoreDisplayProps) {
  const remainingHP = MAX_SCORE - score.score;

  return (
    <div className="mt-4 bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
      <div className="text-center mb-4">
        <span className={`text-5xl font-bold ${getScoreColor(score.score)}`}>
          {score.score}
        </span>
        <span className="text-gray-400 text-xl"> ダメージ</span>
        {getScoreLabel(score.score) && (
          <p className={`text-sm font-semibold mt-1 ${getScoreColor(score.score)}`}>
            {getScoreLabel(score.score)}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-gray-500 shrink-0">HP</span>
        <div className="flex-1 bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-1000 ease-out ${getHPBarColor(remainingHP)}`}
            style={{ width: `${remainingHP}%` }}
          />
        </div>
        <span className="text-xs text-gray-500 shrink-0">{remainingHP}/{MAX_SCORE}</span>
      </div>
    </div>
  );
}
