import { useCallback, useState } from "react";
import type { ScoreResponse } from "../../../../shared/api-types/quest";
import { ScoreDisplay } from "./ScoreDisplay";
import { TypewriterText } from "./TypewriterText";

interface TranslationResultProps {
  userTranslation: string;
  score: ScoreResponse;
}

/**
 * 翻訳の採点結果を表示する。ダメージメーターのアニメーションが完了してから、
 * 博士のコメントをタイプライター演出で表示する。
 * @param props userTranslation / score を含む props。
 * @returns 採点結果表示の要素。
 */
export function TranslationResult({ userTranslation, score }: TranslationResultProps) {
  const [isMeterSettled, setIsMeterSettled] = useState(false);
  const handleMeterSettled = useCallback(() => setIsMeterSettled(true), []);

  return (
    <>
      <div className="mt-4 bg-white rounded-2xl shadow-lg p-5 border border-gray-200">
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-400 mb-1">君の翻訳</p>
          <p className="text-gray-800 text-sm leading-relaxed">
            {userTranslation}
          </p>
        </div>
        {score.review && (
          <div className="mb-3 pt-3 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-400 mb-1">博士からのコメント</p>
            <p className="text-sm text-gray-600 leading-relaxed">
              <TypewriterText text={score.review} isActive={isMeterSettled} />
            </p>
          </div>
        )}
        <div>
          <p className="text-xs font-semibold text-gray-400 mb-1">日本語の説明文</p>
          <p className="text-gray-600 text-sm leading-relaxed">
            「{score.description_ja}」
          </p>
        </div>
      </div>
      <ScoreDisplay score={score} onSettled={handleMeterSettled} />
    </>
  );
}
