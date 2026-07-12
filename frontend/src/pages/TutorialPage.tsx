import { useNavigate } from "react-router-dom";
import { QuestCard } from "../components/quest/QuestCard";
import { TranslationResult } from "../components/quest/TranslationResult";
import { CaptureStandby } from "../components/quest/CaptureStandby";
import { CaptureResult } from "../components/quest/CaptureResult";
import { TutorialTranslationStep } from "../components/tutorial/TutorialTranslationStep";
import { TutorialNameStep } from "../components/tutorial/TutorialNameStep";
import { useTutorialQuest } from "../hooks/useTutorialQuest";

/**
 * TutorialPage の仕様文言。テストから import される SSOT。
 */
export const TUTORIAL_PAGE_LABELS = {
  intro: "あ！　野生の　ポケモンが　飛び出してきた！",
  captureButton: "モンスターボールを　使う",
} as const;

/**
 * 初回チュートリアルのページ。固定シナリオ (ピカチュウ固定・常に満点・常に捕獲成功) を進行させる。
 * @returns チュートリアルページの要素。
 */
export function TutorialPage() {
  const navigate = useNavigate();
  const { phase, quest, score, userTranslation, captureResult, submitTranslation, submitName, capture } =
    useTutorialQuest();

  return (
    <div className="min-h-[calc(100vh-var(--header-h))] bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {phase === "translating" && (
          <>
            <p className="text-center text-gray-700 font-bold text-lg mb-4">
              {TUTORIAL_PAGE_LABELS.intro}
            </p>
            <QuestCard description={quest.description_en} />
            <TutorialTranslationStep onSubmit={submitTranslation} />
          </>
        )}

        {phase === "guessing" && score && (
          <>
            <QuestCard description={quest.description_en} />
            <TranslationResult userTranslation={userTranslation} score={score} />
            <TutorialNameStep onSubmit={submitName} />
          </>
        )}

        {phase === "capturing" && <CaptureStandby ballType="poke" onUse={capture} />}

        {phase === "result" && captureResult && (
          <CaptureResult result={captureResult} onNewQuest={() => navigate("/quest")} />
        )}
      </div>
    </div>
  );
}
