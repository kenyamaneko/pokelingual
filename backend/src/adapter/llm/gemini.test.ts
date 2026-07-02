import { describe, it, expect } from "vitest";
import type { VertexAI } from "@google-cloud/vertexai";
import { GeminiClient } from "./gemini.js";

/**
 * 指定テキストを返すフェイク VertexAI で GeminiClient を組み立てる。
 * @param text モデルが返すテキスト。undefined なら候補なし (空レスポンス)。
 * @returns テスト対象のクライアント。
 */
function makeClient(text: string | undefined): GeminiClient {
  const vertexAI = {
    getGenerativeModel: () => ({
      generateContent: async () => ({
        response: {
          candidates:
            text === undefined ? [] : [{ content: { parts: [{ text }] } }],
        },
      }),
    }),
  } as unknown as VertexAI;
  return new GeminiClient(vertexAI);
}

/**
 * generateText の仕様: Gemini が付けることのあるコードフェンスを剥がして返す。
 * 変換は公開メソッド経由で観測する。
 */
describe("GeminiClient.generateText", () => {
  it.each([
    { name: "```json フェンス", input: '```json\n{"score":70}\n```', expected: '{"score":70}' },
    { name: "``` フェンス", input: "```\nplain text\n```", expected: "plain text" },
    { name: "フェンス無し", input: '{"score":70}', expected: '{"score":70}' },
    { name: "末尾のみフェンス", input: "text```", expected: "text" },
  ])("$name を除去して返す", async ({ input, expected }) => {
    expect(await makeClient(input).generateText("p")).toBe(expected);
  });

  it("空レスポンスはエラーにする", async () => {
    await expect(makeClient(undefined).generateText("p")).rejects.toThrow(/empty response/);
  });
});
