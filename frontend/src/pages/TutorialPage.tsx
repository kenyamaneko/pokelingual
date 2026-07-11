import { useNavigate } from "react-router-dom";
import { QuestCard } from "../components/quest/QuestCard";
import { ScoreDisplay } from "../components/quest/ScoreDisplay";
import { CaptureResult } from "../components/quest/CaptureResult";
import { TutorialTranslationStep } from "../components/tutorial/TutorialTranslationStep";
import { TutorialNameStep } from "../components/tutorial/TutorialNameStep";
import { useTutorialQuest } from "../hooks/useTutorialQuest";

const BALL_SPRITE_URL = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png";

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
  const { phase, quest, score, captureResult, submitTranslation, submitName, capture } = useTutorialQuest();

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
            <ScoreDisplay score={score} />
            <TutorialNameStep onSubmit={submitName} />
          </>
        )}

        {phase === "capturing" && (
          <div className="flex flex-col items-center justify-center py-20">
            <img
              src={BALL_SPRITE_URL}
              alt="モンスターボール"
              className="w-24 h-24 animate-bounce mb-6"
            />
            <button
              onClick={capture}
              className="bg-red-500 text-white py-4 px-12 rounded-2xl font-bold text-xl
                         hover:bg-red-600 transition-colors shadow-lg hover:shadow-xl
                         active:scale-95 transform"
            >
              {TUTORIAL_PAGE_LABELS.captureButton}
            </button>
          </div>
        )}

        {phase === "result" && captureResult && (
          <CaptureResult result={captureResult} onNewQuest={() => navigate("/quest")} />
        )}
      </div>
    </div>
  );
}
