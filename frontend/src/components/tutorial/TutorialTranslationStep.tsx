import { useState } from "react";
import { TutorialInstructionModal } from "./TutorialInstructionModal";

interface Props {
  onSubmit: (translation: string) => boolean;
}

/**
 * TutorialTranslationStep の仕様文言。テストから import される SSOT。
 */
export const TUTORIAL_TRANSLATION_LABELS = {
  modalTitle: "この英文を訳してみよう",
  modalInstruction: "「電気タイプのねずみポケモン」と入力してみてね",
  submitButton: "この翻訳に決めた！",
  missingKeywordsError: "「電気」と「ネズミ」の両方を含めて入力してね",
} as const;

/**
 * チュートリアルの訳文入力 UI。入力すべき内容をモーダルで案内し、
 * 必須キーワードを含まない入力はクライアント側で送信を拒否する。
 * @param props onSubmit を含む props。
 * @returns 訳文入力 UI の要素。
 */
export function TutorialTranslationStep({ onSubmit }: Props) {
  const [showModal, setShowModal] = useState(true);
  const [text, setText] = useState("");
  const [showError, setShowError] = useState(false);

  const handleSubmit = () => {
    const ok = onSubmit(text);
    setShowError(!ok);
  };

  return (
    <div className="mt-4">
      {showModal && (
        <TutorialInstructionModal
          title={TUTORIAL_TRANSLATION_LABELS.modalTitle}
          instruction={TUTORIAL_TRANSLATION_LABELS.modalInstruction}
          onDismiss={() => setShowModal(false)}
        />
      )}
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setShowError(false);
        }}
        placeholder="日本語を入力してね"
        className="w-full h-32 p-4 border-2 border-gray-300 rounded-xl
                   focus:border-blue-500 focus:outline-none text-lg resize-none
                   bg-white text-gray-800"
      />
      {showError && (
        <p className="text-red-600 text-sm mt-2">{TUTORIAL_TRANSLATION_LABELS.missingKeywordsError}</p>
      )}
      <button
        onClick={handleSubmit}
        disabled={!text.trim()}
        className="mt-2 w-full bg-blue-500 text-white py-3 rounded-xl font-bold text-lg
                   hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed
                   transition-colors"
      >
        {TUTORIAL_TRANSLATION_LABELS.submitButton}
      </button>
    </div>
  );
}
