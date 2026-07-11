import { useState } from "react";
import { TutorialInstructionModal } from "./TutorialInstructionModal";

interface Props {
  onSubmit: (name: string) => boolean;
}

/**
 * TutorialNameStep の仕様文言。テストから import される SSOT。
 */
export const TUTORIAL_NAME_LABELS = {
  modalTitle: "このポケモンの名前を当てよう",
  modalInstruction: "「ピカチュウ」または「pikachu」と入力してみてね",
  inputPlaceholder: "ポケモンの名前を入力してね",
  submitButton: "君に　決めた！",
  wrongNameError: "「ピカチュウ」または「pikachu」と入力してね",
} as const;

/**
 * チュートリアルの名前当て入力 UI。入力すべき内容をモーダルで案内し、
 * 一致しない入力はクライアント側で送信を拒否する。
 * @param props onSubmit を含む props。
 * @returns 名前入力 UI の要素。
 */
export function TutorialNameStep({ onSubmit }: Props) {
  const [showModal, setShowModal] = useState(true);
  const [name, setName] = useState("");
  const [showError, setShowError] = useState(false);

  const handleSubmit = () => {
    const ok = onSubmit(name);
    setShowError(!ok);
  };

  return (
    <div className="mt-4 bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
      {showModal && (
        <TutorialInstructionModal
          title={TUTORIAL_NAME_LABELS.modalTitle}
          instruction={TUTORIAL_NAME_LABELS.modalInstruction}
          onDismiss={() => setShowModal(false)}
        />
      )}
      <h3 className="text-lg font-bold text-gray-700 mb-3">
        このポケモンの名前は？
      </h3>
      {showError && (
        <p className="text-red-600 text-sm mb-3">{TUTORIAL_NAME_LABELS.wrongNameError}</p>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setShowError(false);
          }}
          placeholder={TUTORIAL_NAME_LABELS.inputPlaceholder}
          className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl
                     focus:border-blue-500 focus:outline-none text-lg bg-white text-gray-800"
        />
        <button
          onClick={handleSubmit}
          disabled={!name.trim()}
          className="bg-blue-500 text-white px-6 py-3 rounded-xl font-bold
                     hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors"
        >
          {TUTORIAL_NAME_LABELS.submitButton}
        </button>
      </div>
    </div>
  );
}
