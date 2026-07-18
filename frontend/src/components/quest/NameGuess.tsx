import { useRef, useState } from "react";
import type { GuessResponse, HintResponse } from "../../../../shared/api-types/quest";
import type { PokemonType } from "../../../../shared/api-types/pokemon";
import { PokemonNameInput } from "./PokemonNameInput";
import { getTypeLabel } from "../../utils/pokemonTypes";
import { BALL_SPRITES, BALL_NAMES } from "./ballAssets";

/** ヒントボタンを表示するために必要な最小残り挑戦回数。backend の判定と合わせている。 */
const MIN_ATTEMPTS_REMAINING_FOR_HINT_BUTTON = 2;

interface NameGuessProps {
  onSubmit: (guess: string) => Promise<void>;
  onSkip: () => void;
  onProceed: () => void;
  guessResult: GuessResponse | null;
  /** 残り挑戦回数 (推測・ヒントのどちらの操作でも更新される)。 */
  attemptsRemaining: number | null;
  /** 名前当ての最大挑戦回数。残り挑戦回数の表示に使う。 */
  maxGuessAttempts: number | null;
  /** ヒント要求。省略時はヒント関連の表示ごと出さない (本番のみ有効)。 */
  onHint?: () => Promise<void>;
  hintResult: HintResponse | null;
}

/**
 * NameGuess UI の仕様文言。テストから import される SSOT。
 * 文言変更は実装・テスト同時更新になる。
 */
export const NAME_GUESS_LABELS = {
  heading: "このポケモンの名前は？",
  hintButton: "ヒントを見る（挑戦1回を消費）",
  hintUnavailable: "もうヒントは使えないよ",
  movesUnavailable: "このポケモンはレベルアップで覚える技がないみたいだよ",
  skipButton: "わからないのでスキップ →",
  proceedButton: "次へ進む",
  correctTitle: "正解！",
  wrongFinalTitle: "残念...",
} as const;

/**
 * ヒントで判明したタイプから案内文を組み立てる。
 * @param types 出題ポケモンのタイプ (1〜2種)。
 * @returns 「〜タイプのポケモンだよ」形式の案内文。
 */
function formatTypeHint(types: PokemonType[]): string {
  return `${types.map(getTypeLabel).join("・")}タイプのポケモンだよ`;
}

/**
 * ヒントで判明した、レベルアップで覚える技から案内文を組み立てる。
 * @param moves レベルアップで覚える技の日本語名 (最大3件)。
 * @returns 「〜を覚えるよ」形式の案内文。
 */
function formatMovesHint(moves: string[]): string {
  return `「${moves.join("」「")}」を覚えるよ`;
}

interface GuessAttemptsBallsProps {
  total: number;
  remaining: number;
}

/**
 * 残り挑戦回数をモンスターボールの並びで表示する。消費済みの回数分をグレースケールにする。
 * @param props total (最大挑戦回数) / remaining (残り挑戦回数) を含む props。
 * @returns 残り挑戦回数の視覚表示。
 */
function GuessAttemptsBalls({ total, remaining }: GuessAttemptsBallsProps) {
  const consumed = total - remaining;
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-sm text-gray-400">残り</span>
      <div
        role="meter"
        aria-label="残り挑戦回数"
        aria-valuenow={remaining}
        aria-valuemin={0}
        aria-valuemax={total}
        className="flex gap-1"
      >
        {Array.from({ length: total }, (_, i) => (
          <img
            key={i}
            src={BALL_SPRITES.poke}
            alt=""
            aria-hidden="true"
            className={`w-6 h-6 ${i < consumed ? "grayscale opacity-40" : ""}`}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * ポケモン名の推測入力 UI。残り試行数・正誤・最終正解・ヒントの表示を担う。
 * @param props onSubmit / onSkip / onProceed / guessResult / attemptsRemaining / maxGuessAttempts / onHint / hintResult を含む props。
 * @returns 名前推測 UI の要素。
 */
export function NameGuess({
  onSubmit,
  onSkip,
  onProceed,
  guessResult,
  attemptsRemaining,
  maxGuessAttempts,
  onHint,
  hintResult,
}: NameGuessProps) {
  const [hintPending, setHintPending] = useState(false);
  // setState は非同期に反映されるため、同一tick内の連打を防ぐ判定はrefで同期に行う
  const hintPendingRef = useRef(false);

  const isFinished =
    guessResult?.correct || guessResult?.attempts_remaining === 0;
  const hintExhausted = !!hintResult?.moves;
  const hintAvailable =
    attemptsRemaining === null || attemptsRemaining >= MIN_ATTEMPTS_REMAINING_FOR_HINT_BUTTON;
  const canRequestHint = !!onHint && !hintExhausted && !isFinished && hintAvailable;
  const hintExpired = !!onHint && !hintExhausted && !isFinished && !hintAvailable;

  const handleSubmit = async (guess: string) => {
    await onSubmit(guess);
    return true;
  };

  const handleHint = async () => {
    if (!onHint || hintPendingRef.current) return;
    hintPendingRef.current = true;
    setHintPending(true);
    try {
      await onHint();
    } finally {
      hintPendingRef.current = false;
      setHintPending(false);
    }
  };

  return (
    <div className="mt-4 bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
      <h3 className="text-lg font-bold text-gray-700 mb-2">
        {NAME_GUESS_LABELS.heading}
      </h3>
      <p className="text-sm text-gray-500 mb-1">
        英語の名前を当てると捕まえやすいよ！　日本語でもいいよ
      </p>
      {!isFinished && attemptsRemaining !== null && maxGuessAttempts !== null && (
        <GuessAttemptsBalls total={maxGuessAttempts} remaining={attemptsRemaining} />
      )}

      {hintResult && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3">
          {hintResult.types && hintResult.types.length > 0 && (
            <p className="text-blue-700 text-sm">{formatTypeHint(hintResult.types)}</p>
          )}
          {hintResult.moves && (
            <p className="text-blue-700 text-sm">
              {hintResult.moves.length > 0
                ? formatMovesHint(hintResult.moves)
                : NAME_GUESS_LABELS.movesUnavailable}
            </p>
          )}
        </div>
      )}

      {guessResult?.correct && guessResult.ball_type && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-3">
          <p className="text-green-700 font-bold">
            {NAME_GUESS_LABELS.correctTitle}
            {guessResult.fuzzy && "（少し違ったけどOK！）"}
          </p>
          <p className="text-green-600 text-sm">
            {guessResult.language === "en" ? "英語名で正解！" : "日本語名で正解！"}
            　{BALL_NAMES[guessResult.ball_type]}を手に入れた！
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

      {!isFinished && <PokemonNameInput onSubmit={handleSubmit} />}

      {canRequestHint && (
        <button
          onClick={handleHint}
          disabled={hintPending}
          className="mt-2 w-full text-blue-500 hover:text-blue-700 py-2 text-sm
                     border border-blue-200 rounded-xl transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {NAME_GUESS_LABELS.hintButton}
        </button>
      )}
      {hintExpired && (
        <p className="mt-2 text-center text-xs text-gray-400">{NAME_GUESS_LABELS.hintUnavailable}</p>
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
