import { ExternalServiceError } from "../domain/errors.js";
import type { LLMClient } from "../domain/ports.js";
import type {
  ChatContext,
  ChatMessage,
} from "../../../shared/api-types/quest.js";

// ChatRequest / ChatResponse の API 契約型は shared/api-types/quest.d.ts を参照

/** クエストの講評後にオーキド博士キャラとして対話を返すサービス。 */
export class ChatService {
  constructor(private llm: LLMClient) {}

  /** クエスト文脈と会話履歴を踏まえて教授の返信文を生成する。 */
  async reply(ctx: ChatContext, messages: ChatMessage[]): Promise<string> {
    const prompt = buildChatPrompt(ctx, messages);
    try {
      const text = await this.llm.generateText(prompt);
      return text.trim();
    } catch (err) {
      throw new ExternalServiceError("LLM", err as Error);
    }
  }
}

function buildChatPrompt(ctx: ChatContext, messages: ChatMessage[]): string {
  let history = "";
  for (const m of messages) {
    if (m.role === "user") {
      history += `User: ${m.content}\n`;
    } else {
      history += `Professor: ${m.content}\n`;
    }
  }

  return `You are a Pokemon professor who is knowledgeable about both Pokemon and English.
You are chatting with a language learner who just completed a translation quest.

Quest context:
- Pokemon: ${ctx.name_en} (${ctx.name_ja})
- Original English text: "${ctx.description_en}"
- Japanese reference: "${ctx.description_ja}"
- User's translation: "${ctx.translation}"
- Score: ${ctx.score}/100
- Your earlier review: "${ctx.review}"

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
}
