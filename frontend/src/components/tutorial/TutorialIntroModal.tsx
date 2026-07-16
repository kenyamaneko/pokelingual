interface Props {
  onDismiss: () => void;
}

/**
 * TutorialIntroModal の仕様文言。テストから import される SSOT。
 */
export const TUTORIAL_INTRO_LABELS = {
  title: "遊び方の説明をします",
  body: "吹き出しの指示に従って文字を入力してみてね",
  dismissButton: "はじめる",
} as const;

/**
 * チュートリアル開始時に一度だけ遊び方を説明するモーダル。閉じると各ステップの操作に進む。
 * @param props onDismiss を含む props。
 * @returns 遊び方説明モーダルの要素。
 */
export function TutorialIntroModal({ onDismiss }: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-intro-title"
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 text-center"
      >
        <h2 id="tutorial-intro-title" className="text-lg font-bold text-gray-800 mb-3">
          {TUTORIAL_INTRO_LABELS.title}
        </h2>
        <p className="text-sm text-gray-700 leading-relaxed mb-6">{TUTORIAL_INTRO_LABELS.body}</p>
        <button
          onClick={onDismiss}
          className="w-full bg-red-500 text-white py-3 rounded-2xl font-bold
                     hover:bg-red-600 transition-colors shadow"
        >
          {TUTORIAL_INTRO_LABELS.dismissButton}
        </button>
      </div>
    </div>
  );
}
