import { useEffect, useState } from "react";

interface Props {
  title: string;
  instruction: string;
}

/** 案内吹き出しがステップ開始から表示されるまでの遅延 (ミリ秒)。 */
export const INSTRUCTION_APPEAR_DELAY_MS = 600;

/**
 * チュートリアルの各ステップで、入力すべき内容をそのまま案内する常時表示の吹き出し。
 * 背景をブロックせず、入力欄の直上にステップ開始から一定の遅延を置いて表示される。
 * @param props title / instruction を含む props。
 * @returns 案内吹き出しの要素。
 */
export function TutorialInstructionCallout({ title, instruction }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), INSTRUCTION_APPEAR_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      role="note"
      aria-labelledby="tutorial-instruction-title"
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
  );
}
