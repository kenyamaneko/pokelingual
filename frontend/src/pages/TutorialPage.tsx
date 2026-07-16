import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { QuestPage } from "./QuestPage";
import { TutorialInstructionCallout } from "../components/tutorial/TutorialInstructionCallout";
import { TutorialIntroModal } from "../components/tutorial/TutorialIntroModal";
import { TutorialCompletionCallout } from "../components/tutorial/TutorialCompletionCallout";
import { useTutorial } from "../contexts/TutorialContext";
import { tutorialQuestApi } from "../api/questApi";
import { validateTutorialTranslation, validateTutorialName } from "../utils/tutorialValidation";

/**
 * TutorialPage の案内文言。テストから import される SSOT。
 */
export const TUTORIAL_PAGE_LABELS = {
  translation: {
    title: "この英文を訳してみよう",
    instruction: "「電気タイプのねずみポケモン」と入力してみてね",
  },
  name: {
    title: "このポケモンの名前を当てよう",
    instruction: "「ピカチュウ」または「pikachu」と入力してみてね",
  },
} as const;

/**
 * 初回チュートリアルのページ。本番の QuestPage をチュートリアル用 API・入力検証・案内で駆動する。
 * @returns チュートリアルページの要素。
 */
export function TutorialPage() {
  const navigate = useNavigate();
  const { markCompleted } = useTutorial();
  const [introDismissed, setIntroDismissed] = useState(false);

  return (
    <>
      {!introDismissed && <TutorialIntroModal onDismiss={() => setIntroDismissed(true)} />}
      <QuestPage
        questOptions={{
          api: tutorialQuestApi,
          hasLocationChoice: false,
          validateBeforeScore: validateTutorialTranslation,
          validateBeforeGuess: validateTutorialName,
          onResult: markCompleted,
        }}
        slots={{
          translating: (
            <TutorialInstructionCallout
              title={TUTORIAL_PAGE_LABELS.translation.title}
              instruction={TUTORIAL_PAGE_LABELS.translation.instruction}
            />
          ),
          guessing: (
            <TutorialInstructionCallout
              title={TUTORIAL_PAGE_LABELS.name.title}
              instruction={TUTORIAL_PAGE_LABELS.name.instruction}
            />
          ),
          result: <TutorialCompletionCallout />,
        }}
        onNewQuest={() => navigate("/quest")}
      />
    </>
  );
}
