import { useCallback, useRef, useState } from "react";
import type { ScoreResponse } from "../../../../shared/api-types/quest";
import { QuestCard } from "./QuestCard";
import { ScoreDisplay } from "./ScoreDisplay";
import { TypewriterText } from "./TypewriterText";
import { useHasAppeared } from "../../hooks/useHasAppeared";
import { useFadeReveal, FADE_DURATION_MS } from "../../hooks/useFadeReveal";

interface AnswerRevealProps {
  description: string;
  userTranslation: string;
  score: ScoreResponse;
}

const STAGES = ["questText", "translation", "description", "review", "meter"] as const;
type RevealStage = (typeof STAGES)[number];

/**
 * 指定した段階に到達済みか判定する。
 * @param stage 現在の段階。
 * @param target 到達済みか調べたい段階。
 * @returns stage が target 以降なら true。
 */
function hasReachedStage(stage: RevealStage, target: RevealStage): boolean {
  return STAGES.indexOf(stage) >= STAGES.indexOf(target);
}

/**
 * 採点結果画面を、出題英文 → 君の翻訳 → 解答例 → 博士のコメント → HP メーターの順に
 * 段階的に開示する。各段は前段階の完了と要素の初可視化の両方を満たしたときに始まる。
 * @param props description / userTranslation / score を含む props。
 * @returns 採点結果表示の要素。
 */
export function AnswerReveal({ description, userTranslation, score }: AnswerRevealProps) {
  const [stage, setStage] = useState<RevealStage>("questText");

  const handleQuestTextComplete = useCallback(() => setStage("translation"), []);
  const handleTranslationComplete = useCallback(() => setStage("description"), []);
  const handleDescriptionComplete = useCallback(() => setStage("review"), []);
  const handleReviewComplete = useCallback(() => setStage("meter"), []);

  const translationRef = useRef<HTMLParagraphElement>(null);
  const translationAppeared = useHasAppeared(translationRef);
  const translationVisible = useFadeReveal(
    hasReachedStage(stage, "translation") && translationAppeared,
    handleTranslationComplete,
  );

  const reviewRef = useRef<HTMLParagraphElement>(null);
  const reviewAppeared = useHasAppeared(reviewRef);

  const descriptionRef = useRef<HTMLParagraphElement>(null);
  const descriptionAppeared = useHasAppeared(descriptionRef);

  const meterRef = useRef<HTMLDivElement>(null);
  const meterAppeared = useHasAppeared(meterRef);

  return (
    <>
      <div className="mt-4 bg-white rounded-2xl shadow-lg border border-gray-200 divide-y divide-gray-100">
        <div className="p-5">
          <p className="text-xs font-semibold text-gray-400 mb-1">英語版の図鑑の説明</p>
          <QuestCard
            description={description}
            variant="answer"
            prevComplete={true}
            onComplete={handleQuestTextComplete}
          />
        </div>
        <div className="p-5">
          <p className="text-xs font-semibold text-gray-400 mb-1">君の翻訳</p>
          <p
            ref={translationRef}
            data-testid="translation-reveal"
            data-state={translationVisible ? "revealed" : "hidden"}
            className={`text-gray-800 text-base leading-relaxed transition-opacity ${
              translationVisible ? "opacity-100" : "opacity-0"
            }`}
            style={{ transitionDuration: `${FADE_DURATION_MS}ms` }}
          >
            {userTranslation}
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs font-semibold text-gray-400 mb-1">
            解答例（日本語版の図鑑の説明）
          </p>
          <p
            ref={descriptionRef}
            data-testid="description-text"
            className="text-gray-600 text-base leading-relaxed"
          >
            「<TypewriterText
              text={score.description_ja}
              isActive={hasReachedStage(stage, "description") && descriptionAppeared}
              onComplete={handleDescriptionComplete}
            />」
          </p>
        </div>
      </div>

      <div className="mt-4 bg-white rounded-2xl shadow-lg p-5 border border-gray-200">
        <p className="text-xs font-semibold text-gray-400 mb-1">博士からのコメント</p>
        <p ref={reviewRef} data-testid="review-text" className="text-base text-gray-600 leading-relaxed">
          <TypewriterText
            text={score.review}
            isActive={hasReachedStage(stage, "review") && reviewAppeared}
            onComplete={handleReviewComplete}
          />
        </p>
      </div>

      <div ref={meterRef}>
        <ScoreDisplay score={score} isActive={stage === "meter" && meterAppeared} />
      </div>
    </>
  );
}
