import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { QuestCard } from "../components/quest/QuestCard";
import { TranslationResult } from "../components/quest/TranslationResult";
import { CaptureStandby } from "../components/quest/CaptureStandby";
import { CaptureEffect } from "../components/quest/CaptureEffect";
import { CaptureResult } from "../components/quest/CaptureResult";
import { BALL_SPRITES, BALL_NAMES } from "../components/quest/ballAssets";
import { TutorialTranslationStep } from "../components/tutorial/TutorialTranslationStep";
import { TutorialNameStep } from "../components/tutorial/TutorialNameStep";
import { TutorialIntroModal } from "../components/tutorial/TutorialIntroModal";
import { TutorialCompletionCallout } from "../components/tutorial/TutorialCompletionCallout";
import { useQuest } from "../hooks/useQuest";
import { useTutorial } from "../contexts/TutorialContext";
import { createTutorialQuestApi } from "../api/tutorialQuestApi";
import { TUTORIAL_QUEST } from "../utils/tutorialFixtures";
import { validateTutorialTranslation, validateTutorialName } from "../utils/tutorialValidation";

/**
 * TutorialPage の仕様文言。テストから import される SSOT。
 */
export const TUTORIAL_PAGE_LABELS = {
  intro: "あ！　野生の　ポケモンが　飛び出してきた！",
} as const;

/**
 * 初回チュートリアルのページ。本番の useQuest に固定 API・固定出題を注入して駆動し、
 * 採点・名前当ての入力だけチュートリアル用のクライアント検証で受ける。
 * ピカチュウ固定・常に満点・名前当て正解でボール獲得・常に捕獲成功のシナリオを進める。
 * @returns チュートリアルページの要素。
 */
export function TutorialPage() {
  const navigate = useNavigate();
  const tutorialApi = useMemo(() => createTutorialQuestApi(), []);
  const {
    phase,
    quest,
    score,
    userTranslation,
    captureResult,
    ballType,
    submitTranslation,
    submitGuess,
    proceedToCapture,
    capture,
    revealCaptureResult,
  } = useQuest({ api: tutorialApi, initialQuest: TUTORIAL_QUEST, onScored: () => {} });
  const { markCompleted } = useTutorial();
  const [introDismissed, setIntroDismissed] = useState(false);

  useEffect(() => {
    if (phase === "result") markCompleted();
  }, [phase, markCompleted]);

  const handleSubmitTranslation = async (translation: string): Promise<boolean> => {
    if (!validateTutorialTranslation(translation)) return false;
    return submitTranslation(translation);
  };

  const handleSubmitName = async (name: string): Promise<boolean> => {
    if (!validateTutorialName(name)) return false;
    await submitGuess(name);
    proceedToCapture();
    return true;
  };

  return (
    <div className="min-h-[calc(100vh-var(--header-h))] bg-gray-50 py-8">
      {!introDismissed && <TutorialIntroModal onDismiss={() => setIntroDismissed(true)} />}
      <div className="max-w-2xl mx-auto px-4">
        {phase === "translating" && quest && (
          <>
            <p className="text-center text-gray-700 font-bold text-lg mb-4">
              {TUTORIAL_PAGE_LABELS.intro}
            </p>
            <QuestCard description={quest.description_en} />
            <TutorialTranslationStep onSubmit={handleSubmitTranslation} />
          </>
        )}

        {phase === "guessing" && quest && score && (
          <>
            <QuestCard description={quest.description_en} />
            <TranslationResult userTranslation={userTranslation} score={score} />
            <TutorialNameStep onSubmit={handleSubmitName} />
          </>
        )}

        {phase === "capturing" && ballType && (
          <CaptureStandby ballType={ballType} onUse={capture} />
        )}

        {phase === "revealing" && captureResult && (
          <CaptureEffect
            ballSprite={BALL_SPRITES[captureResult.ball_type]}
            ballName={BALL_NAMES[captureResult.ball_type]}
            captured={captureResult.captured}
            onComplete={revealCaptureResult}
          />
        )}

        {phase === "result" && captureResult && (
          <>
            <TutorialCompletionCallout />
            <CaptureResult result={captureResult} onNewQuest={() => navigate("/quest")} />
          </>
        )}
      </div>
    </div>
  );
}
