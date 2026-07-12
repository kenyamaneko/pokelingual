import { useState } from "react";
import type { GuessResponse } from "../../../../shared/api-types/quest";

interface NameGuessProps {
  onSubmit: (guess: string) => Promise<void>;
  onSkip: () => void;
  onProceed: () => void;
  guessResult: GuessResponse | null;
}

/**
 * NameGuess UI の仕様文言。テストから import される SSOT。
 * 文言変更は実装・テスト同時更新になる。
 */
export const NAME_GUESS_LABELS = {
  inputPlaceholder: "ポケモンの名前を入力してね",
  submitButton: "君に　決めた！",
  skipButton: "わからないのでスキップ →",
  proceedButton: "次へ進む",
  correctTitle: "正解！",
  wrongFinalTitle: "残念...",
} as const;

/**
 * ポケモン名の推測入力 UI。残り試行数・正誤・最終正解の表示を担う。
 * @param props onSubmit / onSkip / onProceed / guessResult を含む props。
 * @returns 名前推測 UI の要素。
 */
export function NameGuess({ onSubmit, onSkip, onProceed, guessResult }: NameGuessProps) {
  const [guess, setGuess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isFinished =
    guessResult?.correct || guessResult?.attempts_remaining === 0;

  const handleSubmit = async () => {
    if (!guess.trim() || submitting || isFinished) return;
    setSubmitting(true);
    try {
      await onSubmit(guess);
      setGuess("");
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="mt-4 bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
      <h3 className="text-lg font-bold text-gray-700 mb-2">
        このポケモンの名前は？
      </h3>
      <p className="text-sm text-gray-500 mb-1">
        英語の名前を当てると捕まえやすいよ！　日本語でもいいよ
      </p>
      {!isFinished && guessResult && (
        <p className="text-sm text-gray-400 mb-3">
          残り{guessResult.attempts_remaining}回
        </p>
      )}

      {guessResult?.correct && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-3">
          <p className="text-green-700 font-bold">
            {NAME_GUESS_LABELS.correctTitle}
            {guessResult.fuzzy && "（少し違ったけどOK！）"}
          </p>
          <p className="text-green-600 text-sm">
            {guessResult.language === "en"
              ? "英語名で正解！　ハイパーボールを手に入れた！"
              : "日本語名で正解！　スーパーボールを手に入れた！"}
          </p>
        </div>
      )}

      {guessResult && !guessResult.correct && guessResult.attempts_remaining === 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-3">
          <p className="text-red-700 font-bold">{NAME_GUESS_LABELS.wrongFinalTitle}</p>
          <p className="text-red-600 text-sm">
            答えは　{guessResult.reveal_name_en}（{guessResult.reveal_name_ja}）だったよ
          </p>
        </div>
      )}

      {guessResult && !guessResult.correct && guessResult.attempts_remaining > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-3">
          <p className="text-yellow-700 text-sm">
            {guessResult.attempts_remaining === 1
              ? "はずれ…　ラストチャンス！"
              : "はずれ…　もう一度やってみよう！"}
          </p>
        </div>
      )}

      {!isFinished && (
        <div className="flex gap-2">
          <input
            type="text"
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={NAME_GUESS_LABELS.inputPlaceholder}
            className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl
                       focus:border-blue-500 focus:outline-none text-lg bg-white text-gray-800"
            disabled={submitting}
          />
          <button
            onClick={handleSubmit}
            disabled={!guess.trim() || submitting}
            className="bg-blue-500 text-white px-6 py-3 rounded-xl font-bold
                       hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors"
          >
            {submitting ? "…" : NAME_GUESS_LABELS.submitButton}
          </button>
        </div>
      )}

      <button
        onClick={isFinished ? onProceed : onSkip}
        className="mt-3 w-full text-gray-500 hover:text-gray-700 py-2 text-sm
                   transition-colors"
      >
        {isFinished ? NAME_GUESS_LABELS.proceedButton : NAME_GUESS_LABELS.skipButton}
      </button>
    </div>
  );
}
