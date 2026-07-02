import { VertexAI } from "@google-cloud/vertexai";
import type { GenerativeModel, GenerationConfig } from "@google-cloud/vertexai";
import type { LLMClient } from "../../domain/ports.js";

// @google-cloud/vertexai 1.x は thinkingConfig を型定義していないが REST API は受け付けるため拡張
type GenerationConfigWithThinking = GenerationConfig & {
  thinkingConfig?: { thinkingBudget: number };
};

/** Vertex AI 経由で Gemini を呼び出す LLMClient 実装。 */
export class GeminiClient implements LLMClient {
  private model: GenerativeModel;

  /**
   * @param vertexAI 初期化済みの Vertex AI クライアント。
   */
  constructor(vertexAI: VertexAI) {
    this.model = vertexAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { thinkingConfig: { thinkingBudget: 0 } } as GenerationConfigWithThinking,
    });
  }

  /**
   * プロンプトを Gemini に投げ、生成テキストを返す。
   * @param prompt LLM へ渡すプロンプト文字列。
   * @returns 生成されたテキスト (コードフェンス除去済み)。
   */
  async generateText(prompt: string): Promise<string> {
    const result = await this.model.generateContent(prompt);
    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("empty response from gemini");
    }
    return stripCodeFences(text);
  }
}

/**
 * Gemini が付けることのある ```json ... ``` コードフェンスを剥がす。
 * (JSON 出力を指示しても囲んで返すことがあるため、JSON.parse 前に除去する)
 * @param text Gemini の生レスポンステキスト。
 * @returns コードフェンスを除去したテキスト。
 */
function stripCodeFences(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}
