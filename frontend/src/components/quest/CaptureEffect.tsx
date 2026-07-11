import { useEffect, useState } from "react";

interface CaptureEffectProps {
  ballSprite: string;
  ballName: string;
  captured: boolean;
  onComplete: () => void;
}

/** ボールが揺れる演出の再生時間 (ミリ秒)。CSS 側の揺れアニメーションと揃える (0.3秒 × 3回)。 */
export const SHAKE_DURATION_MS = 900;

/** 成否エフェクト (花火/煙) の再生時間 (ミリ秒)。CSS 側のアニメーション時間と揃える。 */
export const EFFECT_DURATION_MS = 700;

type Stage = "shaking" | "effect";

/**
 * ボール使用後、揺れる演出に続けて成否エフェクト (捕獲成功なら花火風、失敗なら煙幕風) を
 * 再生してから onComplete を呼ぶ捕獲演出シーン。
 * @param props ballSprite/ballName/captured/onComplete を含む props。
 * @returns 捕獲演出シーンの要素。
 */
export function CaptureEffect({ ballSprite, ballName, captured, onComplete }: CaptureEffectProps) {
  const [stage, setStage] = useState<Stage>("shaking");

  useEffect(() => {
    const toEffect = setTimeout(() => setStage("effect"), SHAKE_DURATION_MS);
    return () => clearTimeout(toEffect);
  }, []);

  useEffect(() => {
    if (stage !== "effect") return;
    const complete = setTimeout(onComplete, EFFECT_DURATION_MS);
    return () => clearTimeout(complete);
  }, [stage, onComplete]);

  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="relative w-24 h-24 mb-6">
        <img
          src={ballSprite}
          alt={ballName}
          className={`w-24 h-24 ${
            stage === "shaking" ? "animate-[ball-shake_0.3s_ease-in-out_3]" : ""
          }`}
        />
        {stage === "effect" && (
          <span
            data-testid="capture-effect-fx"
            data-state={captured ? "success" : "failure"}
            className={`absolute inset-0 flex items-center justify-center text-6xl ${
              captured
                ? "animate-[firework-burst_0.7s_ease-out]"
                : "animate-[smoke-puff_0.7s_ease-out]"
            }`}
          >
            {captured ? "\u{1F386}" : "\u{1F4A8}"}
          </span>
        )}
      </div>
    </div>
  );
}
