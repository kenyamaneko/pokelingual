import { useState } from "react";
import { TutorialInstructionModal } from "./TutorialInstructionModal";
import { PokemonNameInput } from "../quest/PokemonNameInput";
import { NAME_GUESS_LABELS } from "../quest/NameGuess";

interface Props {
  onSubmit: (name: string) => boolean;
}

/**
 * TutorialNameStep の仕様文言。テストから import される SSOT。
 * 見出し・入力欄・送信ボタンの文言は本番の NameGuess (NAME_GUESS_LABELS) をそのまま使う。
 */
export const TUTORIAL_NAME_LABELS = {
  modalTitle: "このポケモンの名前を当てよう",
  modalInstruction: "「ピカチュウ」または「pikachu」と入力してみてね",
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
  const [showError, setShowError] = useState(false);

  const handleSubmit = async (name: string) => {
    const ok = onSubmit(name);
    setShowError(!ok);
    return ok;
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
        {NAME_GUESS_LABELS.heading}
      </h3>
      {showError && (
        <p className="text-red-600 text-sm mb-3">{TUTORIAL_NAME_LABELS.wrongNameError}</p>
      )}
      <PokemonNameInput onSubmit={handleSubmit} onChangeText={() => setShowError(false)} />
    </div>
  );
}
