import { useState } from "react";
import { TutorialInstructionCallout } from "./TutorialInstructionCallout";
import { TranslationInput } from "../quest/TranslationInput";

interface Props {
  onSubmit: (translation: string) => Promise<boolean>;
}

/**
 * TutorialTranslationStep の仕様文言。テストから import される SSOT。
 */
export const TUTORIAL_TRANSLATION_LABELS = {
  title: "この英文を訳してみよう",
  instruction: "「電気タイプのねずみポケモン」と入力してみてね",
  missingKeywordsError: "「電気」と「ネズミ」の両方を含めて入力してね",
} as const;

/**
 * チュートリアルの訳文入力 UI。入力すべき内容を吹き出しで案内し、
 * 必須キーワードを含まない入力はクライアント側で送信を拒否する。
 * @param props onSubmit を含む props。
 * @returns 訳文入力 UI の要素。
 */
export function TutorialTranslationStep({ onSubmit }: Props) {
  const [showError, setShowError] = useState(false);

  const handleSubmit = async (translation: string) => {
    const ok = await onSubmit(translation);
    setShowError(!ok);
    return ok;
  };

  return (
    <>
      <TutorialInstructionCallout
        title={TUTORIAL_TRANSLATION_LABELS.title}
        instruction={TUTORIAL_TRANSLATION_LABELS.instruction}
      />
      {showError && (
        <p className="text-red-600 text-sm mt-4">{TUTORIAL_TRANSLATION_LABELS.missingKeywordsError}</p>
      )}
      <TranslationInput onSubmit={handleSubmit} onChangeText={() => setShowError(false)} />
    </>
  );
}
