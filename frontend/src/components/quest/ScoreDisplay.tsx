import type { ScoreResponse } from "../../types";

interface ScoreDisplayProps {
  score: ScoreResponse;
}

function getScoreColor(score: number): string {
  if (score >= 90) return "text-green-600";
  if (score >= 70) return "text-blue-600";
  if (score >= 50) return "text-yellow-600";
  if (score >= 30) return "text-orange-600";
  return "text-red-600";
}

function getHPBarColor(remainingHP: number): string {
  if (remainingHP > 50) return "bg-green-500";
  if (remainingHP > 20) return "bg-yellow-500";
  return "bg-red-500";
}

function getScoreLabel(score: number): string | null {
  if (score >= 100) return "いちげき　ひっさつ！";
  if (score >= 80) return "こうかは　ばつぐんだ！";
  if (score >= 41) return null;
  if (score >= 1) return "こうかは　いまひとつの　ようだ";
  return "こうかが　ないみたいだ...";
}

export function ScoreDisplay({ score }: ScoreDisplayProps) {
  const remainingHP = 100 - score.score;

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
        <span className="text-xs text-gray-500 shrink-0">{remainingHP}/100</span>
      </div>
    </div>
  );
}
