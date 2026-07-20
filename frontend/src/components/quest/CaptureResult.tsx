import { useNavigate } from "react-router-dom";
import type { CaptureResponse } from "../../../../shared/api-types/quest";
import { getTypeColor, getTypeLabel } from "../../utils/pokemonTypes";

interface CaptureResultProps {
  result: CaptureResponse;
  onNewQuest: () => void;
}

/** 種族値合計がこの値以上のポケモンは、非伝説でも「強そう」演出の対象にする (600族=非伝説の最強格の下限)。 */
const STRONG_BASE_STAT_TOTAL_THRESHOLD = 600;

/** 結果画面が白から開始するフェードインの再生時間 (ミリ秒)。CSS 側と揃える。 */
const RESULT_FADE_DURATION_MS = 300;

/**
 * CaptureResult の仕様文言。テストから import される SSOT。
 * タイトル系はポケモン名を埋め込む関数として export する。
 */
export const CAPTURE_RESULT_LABELS = {
  capturedTitle: (nameJa: string) => `やったー！　${nameJa}を　捕まえたぞ！`,
  capturedLegendaryTitle: (nameJa: string) => `やったー！　伝説の　${nameJa}を　捕まえたぞ！`,
  capturedMythicalTitle: (nameJa: string) => `信じられない！　幻の　${nameJa}を　捕まえたぞ！`,
  capturedStrongTitle: (nameJa: string) => `やったー！　強そうな　${nameJa}を　捕まえたぞ！`,
  escapedTitle: (nameJa: string) => `野生の　${nameJa}は　逃げ出した！`,
  nextButton: "次のポケモンを探す",
  backToMenuButton: "メニューに戻る",
} as const;

/**
 * 捕獲結果の表示。成否・伝説/幻/強豪演出・次のクエスト遷移を提供する。
 * @param props result / onNewQuest を含む props。
 * @returns 捕獲結果表示の要素。
 */
export function CaptureResult({ result, onNewQuest }: CaptureResultProps) {
  const navigate = useNavigate();
  const isStrong = result.base_stat_total >= STRONG_BASE_STAT_TOTAL_THRESHOLD;

  return (
    <>
      <div
        aria-hidden="true"
        className="fixed inset-0 z-40 bg-white pointer-events-none"
        style={{
          animationName: "result-whiteout-fade",
          animationDuration: `${RESULT_FADE_DURATION_MS}ms`,
          animationTimingFunction: "ease-out",
          animationFillMode: "forwards",
        }}
      />
      <div
        className="mt-4 text-center"
        style={{
          animationName: "result-fade-in",
          animationDuration: `${RESULT_FADE_DURATION_MS}ms`,
          animationTimingFunction: "ease-out",
        }}
      >
        <div
          className={`rounded-3xl shadow-xl p-8 border-2 ${
            result.captured && result.is_mythical
              ? "bg-gradient-to-b from-purple-100 to-indigo-50 border-purple-400"
              : result.captured && result.is_legendary
                ? "bg-gradient-to-b from-amber-100 to-yellow-50 border-amber-400"
                : result.captured && isStrong
                  ? "bg-gradient-to-b from-orange-100 to-red-50 border-orange-400"
                  : result.captured
                    ? "bg-gradient-to-b from-green-50 to-white border-green-300"
                    : "bg-gradient-to-b from-gray-50 to-white border-gray-300"
          }`}
        >
          {result.captured ? (
            <>
              <h2 className={`text-2xl font-bold mb-4 ${
                result.is_mythical
                  ? "text-purple-700"
                  : result.is_legendary
                    ? "text-amber-700"
                    : isStrong
                      ? "text-orange-700"
                      : "text-green-700"
              }`}>
                {result.is_mythical
                  ? CAPTURE_RESULT_LABELS.capturedMythicalTitle(result.name_ja)
                  : result.is_legendary
                    ? CAPTURE_RESULT_LABELS.capturedLegendaryTitle(result.name_ja)
                    : isStrong
                      ? CAPTURE_RESULT_LABELS.capturedStrongTitle(result.name_ja)
                      : CAPTURE_RESULT_LABELS.capturedTitle(result.name_ja)}
              </h2>
            </>
          ) : (
            <>
              <div className="text-4xl mb-2">&#128168;</div>
              <h2 className="text-2xl font-bold text-gray-600 mb-4">
                {CAPTURE_RESULT_LABELS.escapedTitle(result.name_ja)}
              </h2>
            </>
          )}

          <img
            src={result.sprite_url}
            alt={result.name_en}
            className={`w-40 h-40 mx-auto mb-4 ${
              result.captured ? "" : "opacity-30 grayscale"
            }`}
          />

          <p className="text-xl font-bold text-gray-800" data-testid="captured-name-en">
            {result.name_en}
          </p>
          <p className="text-gray-500" data-testid="captured-name-ja">
            {result.name_ja}
          </p>
          {result.types && result.types.length > 0 && (
            <div className="flex justify-center gap-2 mt-2">
              {result.types.map((t) => (
                <span
                  key={t}
                  className={`${getTypeColor(t)} text-white text-xs font-bold px-3 py-1 rounded-full`}
                >
                  {getTypeLabel(t)}
                </span>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={onNewQuest}
          className="mt-6 w-full bg-red-500 text-white py-4 rounded-2xl font-bold text-lg
                     hover:bg-red-600 transition-colors shadow-lg"
        >
          {CAPTURE_RESULT_LABELS.nextButton}
        </button>

        <button
          onClick={() => navigate("/")}
          className="mt-3 w-full bg-white text-gray-600 py-3 rounded-2xl font-bold text-base
                     border-2 border-gray-200 hover:bg-gray-50 transition-colors"
        >
          {CAPTURE_RESULT_LABELS.backToMenuButton}
        </button>
      </div>
    </>
  );
}
