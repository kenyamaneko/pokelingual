import { useEffect, useState } from "react";
import type { RateLimitDetail } from "../../utils/rateLimitEvents";

interface Props {
  detail: RateLimitDetail;
  onDismiss: () => void;
}

/**
 * RateLimitModal の仕様文言。テストから import される SSOT。
 */
export const RATE_LIMIT_LABELS = {
  userTitle: "きょうの　しゅぎょうは　ここまで！",
  globalTitle: "きょうは　たくさんの　トレーナーが…",
  dismissButton: "また　あした　くる",
  closeButtonAria: "閉じる",
} as const;

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;
/** UTC からの JST (Asia/Tokyo) オフセット。 */
const JST_OFFSET_MS = 9 * MS_PER_HOUR;
/** カウントダウン更新間隔。1 秒毎に再計算する。 */
const COUNTDOWN_TICK_MS = MS_PER_SECOND;

/**
 * レート制限到達を通知し、JST 0:00 までのカウントダウンを表示するモーダル。
 * @param props detail / onDismiss を含む props。
 * @returns レート制限モーダルの要素。
 */
export function RateLimitModal({ detail, onDismiss }: Props) {
  const [countdown, setCountdown] = useState(formatUntilJstMidnight());

  useEffect(() => {
    const id = setInterval(() => setCountdown(formatUntilJstMidnight()), COUNTDOWN_TICK_MS);
    return () => clearInterval(id);
  }, []);

  const title = detail.kind === "user" ? RATE_LIMIT_LABELS.userTitle : RATE_LIMIT_LABELS.globalTitle;

  return (
    <div
      data-testid="rate-limit-backdrop"
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onDismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rate-limit-modal-title"
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="rate-limit-modal-title" className="text-lg font-bold text-gray-800">{title}</h2>
          <button
            onClick={onDismiss}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
            aria-label={RATE_LIMIT_LABELS.closeButtonAria}
          >
            &times;
          </button>
        </div>

        <p className="text-sm text-gray-700 leading-relaxed mb-4">{detail.message}</p>

        <div className="bg-gray-50 rounded-xl p-4 mb-4 text-center">
          <p className="text-xs text-gray-500 mb-1">つぎの　ちょうせんまで（JST 0:00 に リセット）</p>
          <p className="text-2xl font-mono font-bold text-gray-800">{countdown}</p>
        </div>

        <button
          onClick={onDismiss}
          className="w-full bg-red-500 text-white py-3 rounded-2xl font-bold
                     hover:bg-red-600 transition-colors shadow"
        >
          {RATE_LIMIT_LABELS.dismissButton}
        </button>
      </div>
    </div>
  );
}

/**
 * 現在時刻から JST 翌日 0:00 までの残時間を hh:mm:ss で返す。
 * @returns "hh:mm:ss" 形式の残時間。
 */
// eslint-disable-next-line react-refresh/only-export-components -- JST 0:00 境界の単体テストが直接 import するため export する
export function formatUntilJstMidnight(): string {
  // ローカルTZに依存しないよう UTC ベースで JST 翌日 0:00 までの残時間を hh:mm:ss で返す。
  const nowJstMs = Date.now() + JST_OFFSET_MS;
  const msSinceJstMidnight = nowJstMs % MS_PER_DAY;
  const remaining = MS_PER_DAY - msSinceJstMidnight;

  const h = Math.floor(remaining / MS_PER_HOUR);
  const m = Math.floor((remaining % MS_PER_HOUR) / MS_PER_MINUTE);
  const s = Math.floor((remaining % MS_PER_MINUTE) / MS_PER_SECOND);

  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/**
 * 数値を 2 桁ゼロパディングする。
 * @param n 対象の数値。
 * @returns 2 桁ゼロパディングした文字列。
 */
function pad(n: number): string {
  return n.toString().padStart(2, "0");
}
