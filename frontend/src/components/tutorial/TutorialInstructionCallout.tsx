import { useEffect, useState } from "react";

interface Props {
  title: string;
  instruction: string;
  /** 誤答のたびに増分するカウンタ。値の変化を検知して警告シェイクを一回再生する。 */
  invalidAnswerSignal?: number;
}

/** 案内吹き出しがステップ開始から表示されるまでの遅延 (ミリ秒)。 */
export const INSTRUCTION_APPEAR_DELAY_MS = 600;

/** 警告シェイクの再生時間 (ミリ秒)。CSS 側の callout-shake の周期と揃える。 */
export const INVALID_ANSWER_SHAKE_DURATION_MS = 400;

/**
 * チュートリアルの各ステップで、入力すべき内容をそのまま案内する常時表示の吹き出し。
 * 背景をブロックせず、入力欄の直上にステップ開始から一定の遅延を置いて表示される。
 * invalidAnswerSignal が変化すると、誤答が伝わるよう吹き出し全体を一回シェイクさせる。
 * @param props title / instruction / invalidAnswerSignal を含む props。
 * @returns 案内吹き出しの要素。
 */
export function TutorialInstructionCallout({ title, instruction, invalidAnswerSignal = 0 }: Props) {
  const [visible, setVisible] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [lastHandledSignal, setLastHandledSignal] = useState(invalidAnswerSignal);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), INSTRUCTION_APPEAR_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  if (invalidAnswerSignal !== lastHandledSignal) {
    setLastHandledSignal(invalidAnswerSignal);
    setIsShaking(true);
  }

  useEffect(() => {
    if (!isShaking) return;
    const timer = setTimeout(() => setIsShaking(false), INVALID_ANSWER_SHAKE_DURATION_MS);
    return () => clearTimeout(timer);
  }, [isShaking, lastHandledSignal]);

  return (
    <div
      style={
        isShaking
          ? {
              animationName: "callout-shake",
              animationDuration: `${INVALID_ANSWER_SHAKE_DURATION_MS}ms`,
              animationTimingFunction: "ease-in-out",
            }
          : undefined
      }
    >
      <div
        role="note"
        aria-labelledby="tutorial-instruction-title"
        data-state={isShaking ? "invalid" : "idle"}
        style={{ visibility: visible ? "visible" : "hidden" }}
        className={`relative bg-white rounded-2xl shadow-lg p-4 mb-4 border border-gray-200
                    ${visible ? "animate-[callout-pop_0.3s_ease-out]" : ""}`}
      >
        <h2 id="tutorial-instruction-title" className="text-sm font-bold text-gray-800 mb-1">
          {title}
        </h2>
        <p className="text-sm text-gray-600 leading-relaxed">{instruction}</p>
        <div className="absolute left-8 -bottom-2 w-4 h-4 bg-white border-b border-r border-gray-200 rotate-45" />
      </div>
    </div>
  );
}
