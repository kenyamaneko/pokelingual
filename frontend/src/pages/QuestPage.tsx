import { QuestCard } from "../components/quest/QuestCard";
import { TranslationInput } from "../components/quest/TranslationInput";
import { TranslationResult } from "../components/quest/TranslationResult";
import { NameGuess } from "../components/quest/NameGuess";
import { CaptureEffect } from "../components/quest/CaptureEffect";
import { CaptureResult } from "../components/quest/CaptureResult";
import { LocationSelect } from "../components/quest/LocationSelect";
import { useQuest, type BallType } from "../hooks/useQuest";

const BALL_SPRITES: Record<BallType, string> = {
  poke: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png",
  great: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/great-ball.png",
  ultra: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/ultra-ball.png",
};

const BALL_NAMES: Record<BallType, string> = {
  poke: "モンスターボール",
  great: "スーパーボール",
  ultra: "ハイパーボール",
};

/**
 * クエストの主要ページ。フェーズに応じた UI を描画するだけで、状態は useQuest に委譲する。
 * @returns クエストページの要素。
 */
export function QuestPage() {
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
  } = useQuest();

  const isSpecial = quest?.is_legendary || quest?.is_mythical;

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
            <TranslationInput onSubmit={submitTranslation} />
          </>
        )}

        {phase === "guessing" && quest && score && (
          <>
            <QuestCard description={quest.description_en} />
            <TranslationResult userTranslation={userTranslation} score={score} />
            <NameGuess
              onSubmit={submitGuess}
              onSkip={skipGuess}
              onProceed={proceedToCapture}
              guessResult={guessResult}
            />
          </>
        )}

        {phase === "capturing" && ballType && (
          <div className="flex flex-col items-center justify-center py-20">
            <img
              src={BALL_SPRITES[ballType]}
              alt={BALL_NAMES[ballType]}
              className="w-24 h-24 animate-bounce mb-6"
            />
            <p className="text-gray-600 mb-6 text-lg">
              {BALL_NAMES[ballType]}を　手に　入れた！
            </p>
            <button
              onClick={capture}
              className="bg-red-500 text-white py-4 px-12 rounded-2xl font-bold text-xl
                         hover:bg-red-600 transition-colors shadow-lg hover:shadow-xl
                         active:scale-95 transform"
            >
              {BALL_NAMES[ballType]}を　使う
            </button>
          </div>
        )}

        {phase === "revealing" && ballType && captureResult && (
          <CaptureEffect
            ballSprite={BALL_SPRITES[ballType]}
            ballName={BALL_NAMES[ballType]}
            captured={captureResult.captured}
            onComplete={revealCaptureResult}
          />
        )}

        {phase === "result" && captureResult && (
          <CaptureResult
            result={captureResult}
            onNewQuest={startNewQuest}
          />
        )}
      </div>
    </div>
  );
}
