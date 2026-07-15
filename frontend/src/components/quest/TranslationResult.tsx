import { useCallback, useState } from "react";
import type { ScoreResponse } from "../../../../shared/api-types/quest";
import { ScoreDisplay } from "./ScoreDisplay";
import { TypewriterText } from "./TypewriterText";

interface TranslationResultProps {
  userTranslation: string;
  score: ScoreResponse;
}

type RevealStage = "review" | "description" | "meter";

/**
 * 翻訳の採点結果を表示する。博士のコメント → 日本語の説明文 → ダメージメーターの
 * 順に段階的に開示する。
 * @param props userTranslation / score を含む props。
 * @returns 採点結果表示の要素。
 */
export function TranslationResult({ userTranslation, score }: TranslationResultProps) {
  const [stage, setStage] = useState<RevealStage>("review");

  const handleReviewComplete = useCallback(() => setStage("description"), []);
  const handleDescriptionComplete = useCallback(() => setStage("meter"), []);

  return (
    <>
      <div className="mt-4 bg-white rounded-2xl shadow-lg p-5 border border-gray-200">
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-400 mb-1">君の翻訳</p>
          <p className="text-gray-800 text-sm leading-relaxed">
            {userTranslation}
          </p>
        </div>
        <div className="mb-3 pt-3 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-400 mb-1">博士からのコメント</p>
          <p className="text-sm text-gray-600 leading-relaxed">
            <TypewriterText text={score.review} isActive={true} onComplete={handleReviewComplete} />
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-400 mb-1">日本語の説明文</p>
          <p className="text-gray-600 text-sm leading-relaxed">
            「<TypewriterText
              text={score.description_ja}
              isActive={stage === "description" || stage === "meter"}
              onComplete={handleDescriptionComplete}
            />」
          </p>
        </div>
      </div>
      <ScoreDisplay score={score} isActive={stage === "meter"} />
    </>
  );
}
