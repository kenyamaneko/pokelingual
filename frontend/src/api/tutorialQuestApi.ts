import type { QuestApi } from "./questApi";
import type { BallType, GuessResponse } from "../../../shared/api-types/quest";
import { TUTORIAL_SCORE_RESULT, TUTORIAL_CAPTURE_RESULT } from "../utils/tutorialFixtures";

/** チュートリアルで英語名として受け付ける表記 (小文字化して比較する)。 */
const TUTORIAL_ENGLISH_NAME = "pikachu";

/**
 * 名前当ての入力から、獲得するボールと正解言語を決める。
 * 本番の名前当てと同じく、英語名で正解ならハイパーボール、日本語名ならスーパーボールを与える。
 * @param guess 検証済みの入力 (「pikachu」または「ピカチュウ」)。
 * @returns 獲得ボール種別と正解言語。
 */
function classifyTutorialGuess(guess: string): { ball: BallType; language: "en" | "ja" } {
  const normalized = guess.trim().toLowerCase();
  if (normalized === TUTORIAL_ENGLISH_NAME) {
    return { ball: "ultra", language: "en" };
  }
  return { ball: "great", language: "ja" };
}

/**
 * チュートリアル用のインメモリ QuestApi を生成する。backend を一切呼ばず固定シナリオを返すため、
 * チュートリアルの捕獲は図鑑・実績に記録されない。名前当てで獲得したボールを覚え、捕獲結果にも同じボールを載せる。
 * 場所選択・出題・スキップは本フローでは通らないため、呼ばれたら誤配線として失敗させる。
 * @returns 固定応答を返す QuestApi 実装。
 */
export function createTutorialQuestApi(): QuestApi {
  let earnedBall: BallType | null = null;

  return {
    getLocations: () => Promise.reject(new Error("tutorial は場所選択を経由しない")),
    newQuest: () => Promise.reject(new Error("tutorial は出題 API を経由しない")),
    scoreTranslation: () => Promise.resolve({ data: TUTORIAL_SCORE_RESULT }),
    guessName: (guess: string) => {
      const { ball, language } = classifyTutorialGuess(guess);
      earnedBall = ball;
      const data: GuessResponse = {
        correct: true,
        ball_type: ball,
        language,
        attempts_remaining: 0,
      };
      return Promise.resolve({ data });
    },
    skipGuess: () => Promise.reject(new Error("tutorial は名前当てのスキップを提供しない")),
    attemptCapture: () => {
      if (earnedBall === null) {
        return Promise.reject(new Error("capture attempted before a ball was earned (guess required)"));
      }
      return Promise.resolve({ data: { ...TUTORIAL_CAPTURE_RESULT, ball_type: earnedBall } });
    },
  };
}
