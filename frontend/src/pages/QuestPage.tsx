import type { ReactNode } from "react";
import { QuestCard } from "../components/quest/QuestCard";
import { TranslationInput } from "../components/quest/TranslationInput";
import { TranslationResult } from "../components/quest/TranslationResult";
import { NameGuess } from "../components/quest/NameGuess";
import { CaptureStandby } from "../components/quest/CaptureStandby";
import { CaptureEffect } from "../components/quest/CaptureEffect";
import { CaptureResult } from "../components/quest/CaptureResult";
import { LocationSelect } from "../components/quest/LocationSelect";
import { BALL_SPRITES, BALL_NAMES } from "../components/quest/ballAssets";
import { useQuest, type UseQuestOptions } from "../hooks/useQuest";

/** 各入力フェーズの上に差し込む案内 (チュートリアルの吹き出し等)。本番は未指定。 */
interface QuestGuidanceSlots {
  translating?: ReactNode;
  guessing?: ReactNode;
  result?: ReactNode;
}

interface QuestPageProps {
  /** useQuest への依存注入 (省略時は本番既定)。 */
  questOptions?: UseQuestOptions;
  /** 各フェーズに差し込む案内。 */
  slots?: QuestGuidanceSlots;
  /** 結果画面の「次のポケモンを探す」導線 (省略時は新しいクエストを開始)。 */
  onNewQuest?: () => void;
}

/**
 * クエストの主要ページ。フェーズに応じた UI を描画するだけで、状態は useQuest に委譲する。
 * @param props 依存注入・案内スロット・次クエスト導線。
 * @returns クエストページの要素。
 */
export function QuestPage({ questOptions, slots, onNewQuest }: QuestPageProps = {}) {
  const {
    phase,
    quest,
    score,
    guessResult,
    captureResult,
    userTranslation,
    ballType,
    error,
    locations,
    startNewQuest,
    selectLocation,
    submitTranslation,
    submitGuess,
    skipGuess,
    proceedToCapture,
    capture,
    revealCaptureResult,
  } = useQuest(questOptions);

  const isSpecial = quest?.is_legendary || quest?.is_mythical;
  const handleNewQuest = onNewQuest ?? startNewQuest;

  const bgClass = quest?.is_mythical
    ? "min-h-[calc(100vh-var(--header-h))] bg-gradient-to-b from-purple-50 to-gray-50 py-8"
    : quest?.is_legendary
      ? "min-h-[calc(100vh-var(--header-h))] bg-gradient-to-b from-amber-50 to-gray-50 py-8"
      : "min-h-[calc(100vh-var(--header-h))] bg-gray-50 py-8";

  return (
    <div className={bgClass}>
      <div className="max-w-2xl mx-auto px-4">
        {error && phase !== "error" && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
            <p className="text-red-700 text-sm">{error}</p>
            <button
              onClick={startNewQuest}
              className="text-red-500 underline text-sm mt-1"
            >
              もう一度
            </button>
          </div>
        )}

        {phase === "selectLocation" && (
          <LocationSelect locations={locations} onSelect={selectLocation} />
        )}

        {phase === "loading" && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-red-500 mb-4" />
            <p className="text-gray-500">野生のポケモンを探しています</p>
          </div>
        )}

        {phase === "error" && (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-5xl mb-4">!</p>
            <p className="text-gray-700 font-bold text-lg mb-2">エラーが発生しました</p>
            <p className="text-gray-500 text-sm mb-6">{error}</p>
            <button
              onClick={startNewQuest}
              className="bg-red-500 text-white py-3 px-8 rounded-2xl font-bold
                         hover:bg-red-600 transition-colors shadow-lg"
            >
              もう一度探す
            </button>
          </div>
        )}

        {phase === "translating" && quest && (
          <>
            <p className="text-center text-gray-700 font-bold text-lg mb-4">
              あ！　野生の　ポケモンが　飛び出してきた！
            </p>
            {isSpecial && (
              <p className="text-center text-amber-600 font-bold text-sm mb-4 animate-pulse">
                ただならない　気配を感じる...
              </p>
            )}
            <QuestCard description={quest.description_en} />
            {slots?.translating}
            <TranslationInput onSubmit={submitTranslation} />
          </>
        )}

        {phase === "guessing" && quest && score && (
          <>
            <QuestCard description={quest.description_en} />
            <TranslationResult userTranslation={userTranslation} score={score} />
            {slots?.guessing}
            <NameGuess
              onSubmit={submitGuess}
              onSkip={skipGuess}
              onProceed={proceedToCapture}
              guessResult={guessResult}
            />
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
            {slots?.result}
            <CaptureResult result={captureResult} onNewQuest={handleNewQuest} />
          </>
        )}
      </div>
    </div>
  );
}
