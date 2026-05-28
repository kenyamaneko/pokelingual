import { VertexAI } from "@google-cloud/vertexai";
import type { GenerativeModel, GenerationConfig } from "@google-cloud/vertexai";
import type { AIScorer } from "../domain/interfaces.js";
import type { ScoreResult, ChatContext, ChatMessage } from "../types/index.js";

// @google-cloud/vertexai 1.x は thinkingConfig を型定義していないが REST API は受け付けるため拡張
type GenerationConfigWithThinking = GenerationConfig & {
  thinkingConfig?: { thinkingBudget: number };
};

/** Vertex AI 経由で Gemini を呼び出す AIScorer 実装。翻訳採点と教授チャットを担う。 */
export class GeminiService implements AIScorer {
  private model: GenerativeModel;

  constructor(vertexAI: VertexAI) {
    this.model = vertexAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { thinkingConfig: { thinkingBudget: 0 } } as GenerationConfigWithThinking,
    });
  }

  /** 英日翻訳の精度を 0-100 で採点し、講評文を返す。 */
  async scoreTranslation(englishText: string, japaneseTranslation: string): Promise<ScoreResult> {
    const prompt = `You are an English-to-Japanese translation evaluator for a language learning app.

Original English text:
"${englishText}"

User's Japanese translation:
"${japaneseTranslation}"

Evaluate the translation and respond in EXACTLY this JSON format:
{
  "score": <integer 0-100>,
  "review": "<review in Japanese, 2-3 sentences>"
}

Scoring guidelines:
- 90-100: Accurate meaning, natural Japanese, minor issues at most
- 70-89: Core meaning preserved, some awkward phrasing or minor errors
- 50-69: Partially correct, missing important nuances or grammatical issues
- 30-49: Significant errors but some understanding shown
- 0-29: Major misunderstanding or mostly incorrect

Review guidelines:
- Write 2-3 short sentences in Japanese
- You are a kind, supportive Pokemon professor
- If the user left parts untranslated or omitted sections, understand they didn't know the meaning — they are NOT careless, they simply couldn't translate what they didn't understand. Guide them with explanations rather than pointing out "omissions"
- Include explanations of difficult English words/phrases (high school advanced level and above) that appear in the original text — briefly explain their meaning in Japanese
- Use simple kanji with spaces between words (e.g. "「friskily」は 元気よく 跳ね回る という 意味だよ。")
- End with a warm word of praise or encouragement, but vary the expression every time — never repeat the same closing phrase
- Keep the total review under 150 characters

Respond with ONLY the JSON, no other text.`;

    const result = await this.model.generateContent(prompt);
    const response = result.response;

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("empty response from gemini");
    }

    const cleaned = stripCodeFences(text);
    const scoreResult: ScoreResult = JSON.parse(cleaned);

    scoreResult.score = Math.max(0, Math.min(100, scoreResult.score));
    return scoreResult;
  }

  /** クエスト文脈と会話履歴を踏まえてオーキド博士キャラとして応答する。 */
  async chat(chatCtx: ChatContext, messages: ChatMessage[]): Promise<string> {
    let history = "";
    for (const m of messages) {
      if (m.role === "user") {
        history += `User: ${m.content}\n`;
      } else {
        history += `Professor: ${m.content}\n`;
      }
    }

    const prompt = `You are a Pokemon professor who is knowledgeable about both Pokemon and English.
You are chatting with a language learner who just completed a translation quest.

Quest context:
- Pokemon: ${chatCtx.name_en} (${chatCtx.name_ja})
- Original English text: "${chatCtx.description_en}"
- Japanese reference: "${chatCtx.description_ja}"
- User's translation: "${chatCtx.translation}"
- Score: ${chatCtx.score}/100
- Your earlier review: "${chatCtx.review}"

Conversation so far:
${history}
Respond to the user's latest message as the professor.

Guidelines:
- Respond in Japanese with simple kanji and spaces between words
- Be warm, encouraging, and helpful
- Answer questions about the English text, vocabulary, grammar, or the Pokemon
- Keep your response under 200 characters
- Do NOT use markdown formatting

Respond with ONLY your message, no prefix or label.`;

    const result = await this.model.generateContent(prompt);
    const response = result.response;

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("empty response from gemini");
    }

    return text.trim();
  }
}

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
