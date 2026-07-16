/**
 * TutorialCompletionCallout の仕様文言。テストから import される SSOT。
 */
export const TUTORIAL_COMPLETION_LABELS = {
  message: "これでチュートリアルは完了だよ。ポケモンを探しに行こう！",
} as const;

/**
 * チュートリアルの結果画面に表示する完了案内の吹き出し。
 * @returns 完了案内の吹き出しの要素。
 */
export function TutorialCompletionCallout() {
  return (
    <div
      role="note"
      className="relative bg-white rounded-2xl shadow-lg p-4 mb-4 border border-gray-200 text-center"
    >
      <p className="text-sm font-bold text-gray-800 leading-relaxed">
        {TUTORIAL_COMPLETION_LABELS.message}
      </p>
      <div className="absolute left-1/2 -bottom-2 w-4 h-4 -translate-x-1/2 bg-white border-b border-r border-gray-200 rotate-45" />
    </div>
  );
}
