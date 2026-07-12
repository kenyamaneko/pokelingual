import { useCallback, useEffect, useState } from "react";
import { useTutorial } from "../contexts/TutorialContext";
import { validateTutorialTranslation, validateTutorialName } from "../utils/tutorialValidation";
import { TUTORIAL_QUEST, TUTORIAL_SCORE_RESULT, TUTORIAL_CAPTURE_RESULT } from "../utils/tutorialFixtures";
import type { QuestNewResponse, ScoreResponse, CaptureResponse } from "../../../shared/api-types/quest";

/** チュートリアルのフェーズ遷移ステート。 */
export type TutorialPhase = "translating" | "guessing" | "capturing" | "result";

/** useTutorialQuest フックの戻り値。フェーズ・固定データ・操作を提供する。 */
export interface UseTutorialQuestResult {
  phase: TutorialPhase;
  quest: QuestNewResponse;
  score: ScoreResponse | null;
  userTranslation: string;
  captureResult: CaptureResponse | null;
  submitTranslation: (translation: string) => boolean;
  submitName: (name: string) => boolean;
  capture: () => void;
}

/**
 * チュートリアルの固定シナリオを frontend 完結で進行させるフック。
 * @returns フェーズ・固定データ・操作関数を含むチュートリアル状態。
 */
export function useTutorialQuest(): UseTutorialQuestResult {
  const [phase, setPhase] = useState<TutorialPhase>("translating");
  const [score, setScore] = useState<ScoreResponse | null>(null);
  const [userTranslation, setUserTranslation] = useState("");
  const [captureResult, setCaptureResult] = useState<CaptureResponse | null>(null);
  const { markCompleted } = useTutorial();

  const submitTranslation = useCallback((translation: string): boolean => {
    const ok = validateTutorialTranslation(translation);
    if (ok) {
      setScore(TUTORIAL_SCORE_RESULT);
      setUserTranslation(translation);
      setPhase("guessing");
    }
    return ok;
  }, []);

  const submitName = useCallback((name: string): boolean => {
    const ok = validateTutorialName(name);
    if (ok) {
      setPhase("capturing");
    }
    return ok;
  }, []);

  const capture = useCallback(() => {
    setCaptureResult(TUTORIAL_CAPTURE_RESULT);
    setPhase("result");
  }, []);

  useEffect(() => {
    if (phase === "result") {
      markCompleted();
    }
  }, [phase, markCompleted]);

  return {
    phase,
    quest: TUTORIAL_QUEST,
    score,
    userTranslation,
    captureResult,
    submitTranslation,
    submitName,
    capture,
  };
}
