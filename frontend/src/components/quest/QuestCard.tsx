import { useRef } from "react";
import { TypewriterText } from "./TypewriterText";
import { useHasAppeared } from "../../hooks/useHasAppeared";
import { useFadeReveal, FADE_DURATION_MS } from "../../hooks/useFadeReveal";

interface QuestCardProps {
  description: string;
  variant: "quest" | "answer";
  /** answer variant のみ使用。前段階の完了 (要素の可視化との AND でこの段の開始を決める)。 */
  prevComplete?: boolean;
  onComplete?: () => void;
}

/**
 * 出題の英語説明文を表示するクエストカード。quest variant は出題画面用に、シルエットと
 * タイプライター演出で表示する。answer variant は採点結果画面用に、枠なしのフェードイン
 * で表示する。
 * @param props description / variant / prevComplete / onComplete を含む props。
 * @returns クエストカードの要素。
 */
export function QuestCard({ description, variant, prevComplete = true, onComplete }: QuestCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const hasAppeared = useHasAppeared(ref);
  const visible = useFadeReveal(variant === "answer" && prevComplete && hasAppeared, onComplete);

  if (variant === "answer") {
    return (
      <div
        ref={ref}
        data-testid="quest-text-reveal"
        data-state={visible ? "revealed" : "hidden"}
        className={`transition-opacity ${visible ? "opacity-100" : "opacity-0"}`}
        style={{ transitionDuration: `${FADE_DURATION_MS}ms` }}
      >
        <p
          className="text-gray-800 text-base leading-relaxed italic"
          data-testid="quest-description"
        >
          "{description}"
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-red-400">
      <div className="flex flex-col items-center mb-4">
        <div
          className="w-20 h-20 rounded-full bg-gray-900 flex items-center justify-center"
          aria-hidden="true"
        >
          <span className="text-white text-3xl font-bold">？</span>
        </div>
        <h2 className="text-lg font-bold text-gray-700 mt-2">Who's That Pokemon?</h2>
      </div>
      <div className="bg-gray-50 rounded-xl p-4">
        <p
          className="text-gray-800 text-base leading-relaxed italic"
          data-testid="quest-description"
        >
          "<TypewriterText text={description} isActive={true} onComplete={onComplete} />"
        </p>
      </div>
      <p className="text-sm text-gray-500 mt-3 text-center">
        この英文を日本語に翻訳しよう！
      </p>
    </div>
  );
}
