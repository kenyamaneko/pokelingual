import { useEffect, useState } from "react";
import type { RateLimitDetail } from "../../services/rateLimitEvents";

interface Props {
  detail: RateLimitDetail;
  onDismiss: () => void;
}

export function RateLimitModal({ detail, onDismiss }: Props) {
  const [countdown, setCountdown] = useState(formatUntilJstMidnight());

  useEffect(() => {
    const id = setInterval(() => setCountdown(formatUntilJstMidnight()), 1000);
    return () => clearInterval(id);
  }, []);

  const title = detail.kind === "user" ? "きょうの　しゅぎょうは　ここまで！" : "きょうは　たくさんの　トレーナーが…";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onDismiss}>
      <div
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800">{title}</h2>
          <button
            onClick={onDismiss}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
            aria-label="閉じる"
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
          また　あした　くる
        </button>
      </div>
    </div>
  );
}

function formatUntilJstMidnight(): string {
  // JST の翌日 0:00 までの残時間を hh:mm:ss で返す。ローカルTZに依存しないよう UTC で計算
  const nowUtcMs = Date.now();
  const nowJstMs = nowUtcMs + 9 * 60 * 60 * 1000;
  const msSinceJstMidnight = nowJstMs % (24 * 60 * 60 * 1000);
  const remaining = 24 * 60 * 60 * 1000 - msSinceJstMidnight;

  const h = Math.floor(remaining / (60 * 60 * 1000));
  const m = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
  const s = Math.floor((remaining % (60 * 1000)) / 1000);

  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}
