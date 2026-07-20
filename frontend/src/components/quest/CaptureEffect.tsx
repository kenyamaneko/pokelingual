import { useEffect, useState, type CSSProperties } from "react";

interface CaptureEffectProps {
  ballSprite: string;
  ballName: string;
  captured: boolean;
  onComplete: () => void;
}

/** 揺れ1回分の再生時間 (ミリ秒)。CSS 側の揺れ区間と揃える。 */
const SHAKE_ACTIVE_MS = 300;

/** 揺れの後の静止時間 (ミリ秒)。CSS 側の静止区間と揃える。 */
const SHAKE_PAUSE_MS = 200;

/** 「揺れ→静止」1セットの周期 (ミリ秒)。CSS keyframe の周期と揃える。 */
export const SHAKE_SET_MS = SHAKE_ACTIVE_MS + SHAKE_PAUSE_MS;

/** ボールが揺れる演出の再生時間 (ミリ秒)。「揺れ→静止」を3セット行う。 */
export const SHAKE_DURATION_MS = SHAKE_SET_MS * 3;

/** 成否エフェクト (成功時は粒子の飛散、失敗時は煙) の再生時間 (ミリ秒)。CSS 側のアニメーション時間と揃える。 */
export const EFFECT_DURATION_MS = 700;

/** 捕獲演出から結果画面へ切り替わる白フェードの再生時間 (ミリ秒)。CSS 側と揃える。 */
export const WHITEOUT_DURATION_MS = 400;

const BURST_PARTICLE_COUNT = 18;
const BURST_MIN_DISTANCE_PX = 32;
const BURST_MAX_DISTANCE_PX = 96;
const BURST_COLORS = ["#facc15", "#fb923c"];

const SMOKE_CIRCLE_COUNT = 30;
const SMOKE_SPREAD_PX = 35;

type Stage = "shaking" | "effect" | "whiteout";

interface BurstParticle {
  id: number;
  color: string;
  style: CSSProperties;
}

interface SmokeCircle {
  id: number;
  style: CSSProperties;
}

/**
 * 捕獲成功時に飛散させる粒子の角度・距離・色をランダムに生成する。
 * @returns 生成した粒子の一覧。
 */
function createBurstParticles(): BurstParticle[] {
  return Array.from({ length: BURST_PARTICLE_COUNT }, (_, id) => {
    const angle = Math.random() * 2 * Math.PI;
    const distance =
      BURST_MIN_DISTANCE_PX + Math.random() * (BURST_MAX_DISTANCE_PX - BURST_MIN_DISTANCE_PX);
    return {
      id,
      color: BURST_COLORS[id % BURST_COLORS.length],
      style: {
        "--tx": `${Math.cos(angle) * distance}px`,
        "--ty": `${Math.sin(angle) * distance}px`,
      } as CSSProperties,
    };
  });
}

/**
 * 捕獲失敗時に広がる煙の円をランダムな位置に生成する。
 * @returns 生成した円の一覧。
 */
function createSmokeCircles(): SmokeCircle[] {
  return Array.from({ length: SMOKE_CIRCLE_COUNT }, (_, id) => ({
    id,
    style: {
      "--sx": `${(Math.random() - 0.5) * 2 * SMOKE_SPREAD_PX}px`,
      "--sy": `${(Math.random() - 0.5) * 2 * SMOKE_SPREAD_PX}px`,
    } as CSSProperties,
  }));
}

/**
 * ボール使用後、揺れる演出に続けて成否エフェクト (捕獲成功なら花火風、失敗なら煙幕風) を
 * 再生してから onComplete を呼ぶ捕獲演出シーン。
 * @param props ballSprite/ballName/captured/onComplete を含む props。
 * @returns 捕獲演出シーンの要素。
 */
export function CaptureEffect({ ballSprite, ballName, captured, onComplete }: CaptureEffectProps) {
  const [stage, setStage] = useState<Stage>("shaking");
  const [burstParticles] = useState(createBurstParticles);
  const [smokeCircles] = useState(createSmokeCircles);

  useEffect(() => {
    const toEffect = setTimeout(() => setStage("effect"), SHAKE_DURATION_MS);
    return () => clearTimeout(toEffect);
  }, []);

  useEffect(() => {
    if (stage !== "effect") return;
    const toWhiteout = setTimeout(() => setStage("whiteout"), EFFECT_DURATION_MS);
    return () => clearTimeout(toWhiteout);
  }, [stage]);

  useEffect(() => {
    if (stage !== "whiteout") return;
    const complete = setTimeout(onComplete, WHITEOUT_DURATION_MS);
    return () => clearTimeout(complete);
  }, [stage, onComplete]);

  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="relative w-24 h-24 mb-6">
        <img
          src={ballSprite}
          alt={ballName}
          className="w-24 h-24 origin-bottom"
          style={
            stage === "shaking"
              ? {
                  animationName: "ball-shake",
                  animationDuration: `${SHAKE_SET_MS}ms`,
                  animationTimingFunction: "ease-in-out",
                  animationIterationCount: 3,
                }
              : undefined
          }
        />
        {stage === "effect" && (
          <div data-testid="capture-effect-fx" data-state={captured ? "success" : "failure"} className="absolute inset-0">
            {captured
              ? burstParticles.map((particle) => (
                  <span
                    key={particle.id}
                    style={{ ...particle.style, backgroundColor: particle.color }}
                    className="absolute left-1/2 top-1/2 w-3 h-3 rounded-full animate-[particle-burst_0.7s_ease-out]"
                  />
                ))
              : smokeCircles.map((circle) => (
                  <span
                    key={circle.id}
                    style={circle.style}
                    className="absolute left-1/2 top-1/2 w-8 h-8 rounded-full bg-gray-400 animate-[smoke-circle_0.7s_ease-out]"
                  />
                ))}
          </div>
        )}
      </div>
      {stage === "whiteout" && (
        <div
          data-testid="capture-whiteout"
          className="fixed inset-0 bg-white pointer-events-none"
          style={{
            animationName: "capture-whiteout",
            animationDuration: `${WHITEOUT_DURATION_MS}ms`,
            animationTimingFunction: "ease-out",
            animationFillMode: "forwards",
          }}
        />
      )}
    </div>
  );
}
