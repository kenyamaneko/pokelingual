import { describe, it, expect } from "vitest";
import type { VertexAI } from "@google-cloud/vertexai";
import { GeminiClient } from "./gemini.js";

/**
 * 指定の candidates を返すフェイク VertexAI で GeminiClient を組み立てる。
 * @param candidates Vertex AI レスポンスの candidates 配列。
 * @returns テスト対象のクライアント。
 */
function makeClientWithCandidates(candidates: unknown[]): GeminiClient {
  const vertexAI = {
    getGenerativeModel: () => ({
      generateContent: async () => ({ response: { candidates } }),
    }),
  } as unknown as VertexAI;
  return new GeminiClient(vertexAI, "gemini-test");
}

/**
 * 指定テキストを返すフェイク VertexAI で GeminiClient を組み立てる。
 * @param text モデルが返すテキスト。
 * @returns テスト対象のクライアント。
 */
function makeClient(text: string): GeminiClient {
  return makeClientWithCandidates([{ content: { parts: [{ text }] } }]);
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

  // JSON として解釈できないテキストの扱いは、JSON を解釈する側 (quest-service) の
  // テストで確かめる。ここではクライアント自身が検出すべき欠落レスポンスを網羅する。
  it.each([
    { name: "candidates が空", candidates: [] },
    { name: "content が欠落", candidates: [{}] },
    { name: "parts が欠落", candidates: [{ content: {} }] },
    { name: "parts が空", candidates: [{ content: { parts: [] } }] },
    { name: "text が空文字", candidates: [{ content: { parts: [{ text: "" }] } }] },
  ])("$name のレスポンスはエラーにする", async ({ candidates }) => {
    await expect(makeClientWithCandidates(candidates).generateText("p")).rejects.toThrow(
      /empty response/,
    );
  });
});
