import { useEffect, useState } from "react";
import type { ScoreResponse } from "../../../../shared/api-types/quest";
import { getScoreLabel } from "../../utils/scoreLabel";

interface ScoreDisplayProps {
  score: ScoreResponse;
  isActive: boolean;
}

/** スコア最大値。HP バー (100 - score) の上限としても使う。 */
const MAX_SCORE = 100;

/** メーターと HP 数値を満タンから残量まで減少させるのにかける時間 (ミリ秒)。 */
export const METER_ANIMATION_DURATION_MS = 1000;

/** メーターと HP 数値のカウントダウン更新間隔 (ミリ秒)。 */
const HP_COUNTDOWN_TICK_MS = 50;

/** メーターの減少が終わってからダメージ数値・こうかラベルを出すまでの間 (ミリ秒)。 */
export const DAMAGE_REVEAL_DELAY_MS = 300;

/** アニメーション時間内のカウントダウン更新回数。 */
const HP_COUNTDOWN_TICK_COUNT = METER_ANIMATION_DURATION_MS / HP_COUNTDOWN_TICK_MS;

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

/**
 * スコアに応じた文字色クラスを返す。
 * @param score 採点スコア。
 * @returns Tailwind の文字色クラス。
 */
function getScoreColor(score: number): string {
  if (score >= SCORE_COLOR_THRESHOLDS.green) return "text-green-600";
  if (score >= SCORE_COLOR_THRESHOLDS.blue) return "text-blue-600";
  if (score >= SCORE_COLOR_THRESHOLDS.yellow) return "text-yellow-600";
  if (score >= SCORE_COLOR_THRESHOLDS.orange) return "text-orange-600";
  return "text-red-600";
}

/**
 * 残 HP に応じた HP バーの色クラスを返す。
 * @param remainingHP 残 HP (100 - score)。
 * @returns Tailwind の背景色クラス。
 */
function getHPBarColor(remainingHP: number): string {
  if (remainingHP > HP_BAR_THRESHOLDS.green) return "bg-green-500";
  if (remainingHP > HP_BAR_THRESHOLDS.yellow) return "bg-yellow-500";
  return "bg-red-500";
}

/**
 * 採点結果をダメージ表現で表示する。isActive になるとメーターと HP 数値が満タンから
 * 残量まで連動して減少し、その減少が終わってからダメージ数値とこうかラベルを表示する。
 * @param props score / isActive を含む props。
 * @returns スコア表示の要素。
 */
export function ScoreDisplay({ score, isActive }: ScoreDisplayProps) {
  const remainingHP = MAX_SCORE - score.score;
  const [displayedHP, setDisplayedHP] = useState(MAX_SCORE);
  const [hasSettled, setHasSettled] = useState(false);

  useEffect(() => {
    if (!isActive) return;
    let tickCount = 0;
    const countdown = setInterval(() => {
      tickCount += 1;
      const progress = Math.min(tickCount / HP_COUNTDOWN_TICK_COUNT, 1);
      setDisplayedHP(Math.round(MAX_SCORE - progress * (MAX_SCORE - remainingHP)));
    }, HP_COUNTDOWN_TICK_MS);
    const settleTimer = setTimeout(() => {
      clearInterval(countdown);
      setDisplayedHP(remainingHP);
    }, METER_ANIMATION_DURATION_MS);
    const revealTimer = setTimeout(() => {
      setHasSettled(true);
    }, METER_ANIMATION_DURATION_MS + DAMAGE_REVEAL_DELAY_MS);
    return () => {
      clearInterval(countdown);
      clearTimeout(settleTimer);
      clearTimeout(revealTimer);
    };
  }, [isActive, remainingHP]);

  return (
    <div className="mt-4 bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
      <div className="text-center mb-4">
        {hasSettled && (
          <>
            <span
              data-testid="damage-value"
              className={`text-5xl font-bold ${getScoreColor(score.score)}`}
            >
              {score.score}%
            </span>
            <span className="text-gray-400 text-xl"> ダメージ</span>
            {getScoreLabel(score.score) && (
              <p className={`text-sm font-semibold mt-1 ${getScoreColor(score.score)}`}>
                {getScoreLabel(score.score)}
              </p>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-gray-500 shrink-0">HP</span>
        <div
          role="meter"
          aria-label="HP"
          aria-valuenow={displayedHP}
          aria-valuemin={0}
          aria-valuemax={MAX_SCORE}
          className="flex-1 bg-gray-200 rounded-full h-3"
        >
          <div
            className={`h-3 rounded-full transition-all ease-linear ${getHPBarColor(remainingHP)}`}
            style={{
              width: `${displayedHP}%`,
              transitionDuration: `${HP_COUNTDOWN_TICK_MS}ms`,
            }}
          />
        </div>
        <span className="text-xs text-gray-500 shrink-0">{displayedHP}%</span>
      </div>
    </div>
  );
}
