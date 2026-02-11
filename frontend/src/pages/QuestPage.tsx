import { useState, useEffect, useCallback } from "react";
import { questApi } from "../services/questApi";
import { QuestCard } from "../components/quest/QuestCard";
import { TranslationInput } from "../components/quest/TranslationInput";
import { ScoreDisplay } from "../components/quest/ScoreDisplay";
import { NameGuess } from "../components/quest/NameGuess";
import { CaptureResult } from "../components/quest/CaptureResult";
import type {
  QuestNewResponse,
  ScoreResponse,
  GuessResponse,
  CaptureResponse,
} from "../types";

type QuestPhase =
  | "loading"
  | "translating"
  | "scored"
  | "guessing"
  | "capturing"
  | "result";

type BallType = "poke" | "great" | "ultra";

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

export function QuestPage() {
  const [phase, setPhase] = useState<QuestPhase>("loading");
  const [quest, setQuest] = useState<QuestNewResponse | null>(null);
  const [score, setScore] = useState<ScoreResponse | null>(null);
  const [guessResult, setGuessResult] = useState<GuessResponse | null>(null);
  const [captureResult, setCaptureResult] = useState<CaptureResponse | null>(
    null
  );
  const [userTranslation, setUserTranslation] = useState("");
  const [error, setError] = useState<string | null>(null);

  const startNewQuest = useCallback(async () => {
    setPhase("loading");
    setQuest(null);
    setScore(null);
    setGuessResult(null);
    setCaptureResult(null);
    setUserTranslation("");
    setError(null);

    try {
      const res = await questApi.newQuest();
      setQuest(res.data);
      setPhase("translating");
    } catch {
      setError("つうしん エラー！ もういちど ためしてね");
      setPhase("translating");
    }
  }, []);

  useEffect(() => {
    startNewQuest();
  }, [startNewQuest]);

  const handleTranslationSubmit = async (translation: string) => {
    try {
      setUserTranslation(translation);
      const res = await questApi.scoreTranslation(translation);
      setScore(res.data);
      setPhase("guessing");
    } catch {
      setError("さいてんに しっぱい！ もういちど ためしてね");
    }
  };

  const handleGuessSubmit = async (guess: string) => {
    try {
      const res = await questApi.guessName(guess);
      setGuessResult(res.data);
    } catch {
      setError("なまえの はんていに しっぱい！");
    }
  };

  const getBallType = (): BallType => {
    if (guessResult?.correct && guessResult.language === "en") return "ultra";
    if (guessResult?.correct && guessResult.language === "ja") return "great";
    return "poke";
  };

  const handleSkipGuess = () => {
    setPhase("capturing");
  };

  const handleCapture = async () => {
    try {
      const res = await questApi.attemptCapture();
      setCaptureResult(res.data);
      setPhase("result");
    } catch {
      setError("ほかくの はんていに しっぱい！");
    }
  };

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
            <p className="text-red-700 text-sm">{error}</p>
            <button
              onClick={startNewQuest}
              className="text-red-500 underline text-sm mt-1"
            >
              もういちど
            </button>
          </div>
        )}

        {phase === "loading" && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-red-500 mb-4" />
            <p className="text-gray-500">やせいの ポケモンを さがしています…</p>
          </div>
        )}

        {phase === "translating" && quest && (
          <>
            <p className="text-center text-gray-700 font-bold text-lg mb-4">
              あ！ やせいの ？？？ がとびだしてきた！
            </p>
            <QuestCard description={quest.description_en} />
            <TranslationInput onSubmit={handleTranslationSubmit} />
          </>
        )}

        {phase === "guessing" && quest && score && (
          <>
            <QuestCard description={quest.description_en} />
            <div className="mt-4 bg-white rounded-2xl shadow-lg p-5 border border-gray-200">
              <div className="mb-3">
                <p className="text-xs font-semibold text-gray-400 mb-1">きみの ほんやく</p>
                <p className="text-gray-800 text-sm leading-relaxed">
                  {userTranslation}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 mb-1">にほんごの せつめいぶん</p>
                <p className="text-gray-600 text-sm leading-relaxed">
                  「{score.description_ja}」
                </p>
              </div>
            </div>
            <ScoreDisplay score={score} />
            <NameGuess
              onSubmit={handleGuessSubmit}
              onSkip={handleSkipGuess}
              guessResult={guessResult}
            />
          </>
        )}

        {phase === "capturing" && (() => {
          const ball = getBallType();
          return (
            <div className="flex flex-col items-center justify-center py-20">
              <img
                src={BALL_SPRITES[ball]}
                alt={BALL_NAMES[ball]}
                className="w-24 h-24 animate-bounce mb-6"
              />
              <p className="text-gray-600 mb-6 text-lg">
                {BALL_NAMES[ball]}を なげますか？
              </p>
              <button
                onClick={handleCapture}
                className="bg-red-500 text-white py-4 px-12 rounded-2xl font-bold text-xl
                           hover:bg-red-600 transition-colors shadow-lg hover:shadow-xl
                           active:scale-95 transform"
              >
                なげる！
              </button>
            </div>
          );
        })()}

        {phase === "result" && captureResult && (
          <CaptureResult result={captureResult} onNewQuest={startNewQuest} />
        )}
      </div>
    </div>
  );
}
