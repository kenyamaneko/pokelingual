interface Props {
  title: string;
  instruction: string;
  onDismiss: () => void;
}

/**
 * TutorialInstructionModal の仕様文言。テストから import される SSOT。
 */
export const TUTORIAL_MODAL_LABELS = {
  dismissButton: "わかった！",
} as const;

/**
 * チュートリアルの各ステップで、入力すべき内容をそのまま案内するモーダル。
 * @param props title / instruction / onDismiss を含む props。
 * @returns 案内モーダルの要素。
 */
export function TutorialInstructionModal({ title, instruction, onDismiss }: Props) {
  return (
    <div
      data-testid="tutorial-instruction-backdrop"
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onDismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-instruction-title"
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="tutorial-instruction-title" className="text-lg font-bold text-gray-800 mb-3">
          {title}
        </h2>
        <p className="text-sm text-gray-700 leading-relaxed mb-4">{instruction}</p>
        <button
          onClick={onDismiss}
          className="w-full bg-red-500 text-white py-3 rounded-2xl font-bold
                     hover:bg-red-600 transition-colors shadow"
        >
          {TUTORIAL_MODAL_LABELS.dismissButton}
        </button>
      </div>
    </div>
  );
}
