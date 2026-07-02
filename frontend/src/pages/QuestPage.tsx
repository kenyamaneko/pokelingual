import { QuestCard } from "../components/quest/QuestCard";
import { TranslationInput } from "../components/quest/TranslationInput";
import { ScoreDisplay } from "../components/quest/ScoreDisplay";
import { NameGuess } from "../components/quest/NameGuess";
import { CaptureResult } from "../components/quest/CaptureResult";
import { useQuest, type BallType } from "../hooks/useQuest";
import type { ChatContext } from "../../../shared/api-types/quest";

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
    startNewQuest,
    submitTranslation,
    submitGuess,
    skipGuess,
    capture,
  } = useQuest();

  const isSpecial = quest?.is_legendary || quest?.is_mythical;

  const bgClass = quest?.is_mythical
    ? "min-h-[calc(100vh-56px)] bg-gradient-to-b from-purple-50 to-gray-50 py-8"
    : quest?.is_legendary
      ? "min-h-[calc(100vh-56px)] bg-gradient-to-b from-amber-50 to-gray-50 py-8"
      : "min-h-[calc(100vh-56px)] bg-gray-50 py-8";

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

        {phase === "loading" && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-red-500 mb-4" />
            <p className="text-gray-500">やせいの　ポケモンを　さがしています…</p>
          </div>
        )}

        {phase === "error" && (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-5xl mb-4">!</p>
            <p className="text-gray-700 font-bold text-lg mb-2">エラーが　はっせいしました</p>
            <p className="text-gray-500 text-sm mb-6">{error}</p>
            <button
              onClick={startNewQuest}
              className="bg-red-500 text-white py-3 px-8 rounded-2xl font-bold
                         hover:bg-red-600 transition-colors shadow-lg"
            >
              もう一度　さがす
            </button>
          </div>
        )}

        {phase === "translating" && quest && (
          <>
            <p className="text-center text-gray-700 font-bold text-lg mb-4">
              あ！　やせいの　ポケモンが　とび出してきた！
            </p>
            {isSpecial && (
              <p className="text-center text-amber-600 font-bold text-sm mb-4 animate-pulse">
                ただならぬ　けはいを　感じる…
              </p>
            )}
            <QuestCard description={quest.description_en} />
            <TranslationInput onSubmit={submitTranslation} />
          </>
        )}

        {phase === "guessing" && quest && score && (
          <>
            <QuestCard description={quest.description_en} />
            <div className="mt-4 bg-white rounded-2xl shadow-lg p-5 border border-gray-200">
              <div className="mb-3">
                <p className="text-xs font-semibold text-gray-400 mb-1">きみの　ほんやく</p>
                <p className="text-gray-800 text-sm leading-relaxed">
                  {userTranslation}
                </p>
              </div>
              {score.review && (
                <div className="mb-3 pt-3 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 mb-1">はかせからの　コメント</p>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {score.review}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-gray-400 mb-1">日本語の　せつめい文</p>
                <p className="text-gray-600 text-sm leading-relaxed">
                  「{score.description_ja}」
                </p>
              </div>
            </div>
            <ScoreDisplay score={score} />
            <NameGuess
              onSubmit={submitGuess}
              onSkip={skipGuess}
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

        {phase === "result" && captureResult && quest && score && (
          <CaptureResult
            result={captureResult}
            chatContext={{
              description_en: quest.description_en,
              description_ja: score.description_ja,
              translation: userTranslation,
              score: score.score,
              review: score.review,
              name_en: captureResult.name_en,
              name_ja: captureResult.name_ja,
            } satisfies ChatContext}
            onNewQuest={startNewQuest}
          />
        )}
      </div>
    </div>
  );
}
