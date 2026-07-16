import type { LLMClient } from "../../domain/ports.js";

const TUTORIAL_SCORE = 100;
const TUTORIAL_REVIEW = "かんぺきな　ほんやくだ！";

/** 翻訳採点に対して常に満点を返す LLMClient 実装。 */
export class TutorialLLMClient implements LLMClient {
  /**
   * @param prompt サービス側が組み立てたプロンプト文字列。
   * @returns 満点の採点結果 JSON 文字列。
   * @throws 採点用でないプロンプトが渡された場合。
   */
  async generateText(prompt: string): Promise<string> {
    if (prompt.includes("translation evaluator")) {
      return JSON.stringify({ score: TUTORIAL_SCORE, review: TUTORIAL_REVIEW });
    }
    throw new Error("TutorialLLMClient: prompt does not match the scoring task marker");
  }
}
