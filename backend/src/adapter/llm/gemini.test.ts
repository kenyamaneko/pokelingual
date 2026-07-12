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
describe("AI 応答の解釈", () => {
  it.each([
    [
      "AI 応答が ```json 付きコードブロックで囲まれているとき、囲みを除いた本文だけになる",
      '```json\n{"score":70}\n```',
      '{"score":70}',
    ],
    [
      "AI 応答が ``` だけのコードブロックで囲まれているとき、囲みを除いた本文だけになる",
      "```\nplain text\n```",
      "plain text",
    ],
    ["AI 応答がコードブロックで囲まれていないとき、本文がそのまま返る", '{"score":70}', '{"score":70}'],
    ["AI 応答の末尾にだけ ``` があるとき、そこまでの本文になる", "text```", "text"],
  ])("%s", async (_name, input, expected) => {
    expect(await makeClient(input).generateText("p")).toBe(expected);
  });

  // JSON として解釈できないテキストの扱いは、JSON を解釈する側 (quest-service) の
  // テストで確かめる。ここではクライアント自身が検出すべき欠落レスポンスを網羅する。
  it.each([
    ["応答の candidates が空のとき、エラーになる", []],
    ["応答の candidates に content が無いとき、エラーになる", [{}]],
    ["応答の content に parts が無いとき、エラーになる", [{ content: {} }]],
    ["応答の parts が空のとき、エラーになる", [{ content: { parts: [] } }]],
    ["応答の parts のテキストが空文字のとき、エラーになる", [{ content: { parts: [{ text: "" }] } }]],
  ])("%s", async (_name, candidates) => {
    await expect(makeClientWithCandidates(candidates).generateText("p")).rejects.toThrow(
      /empty response/,
    );
  });
});
