import { describe, it, expect } from "vitest";
import type { VertexAI } from "@google-cloud/vertexai";
import { GeminiClient } from "./gemini.js";

function makeClientWithCandidates(candidates: unknown[]): GeminiClient {
  const vertexAI = {
    getGenerativeModel: () => ({
      generateContent: async () => ({ response: { candidates } }),
    }),
  } as unknown as VertexAI;
  return new GeminiClient(vertexAI, "gemini-test");
}

function makeClient(text: string): GeminiClient {
  return makeClientWithCandidates([{ content: { parts: [{ text }] } }]);
}

describe("[外部連携:AI 呼び出し]AI 応答からのテキスト取り出し", () => {
  describe("AI にテキストの生成を依頼すると", () => {
    describe("単体テスト", () => {
      describe("正常系", () => {
        it('AI 応答が「```json」で始まり「```」で終わるコードブロックで囲まれた {"score":70} のとき、得られるテキストは {"score":70} になる', async () => {
          expect(await makeClient('```json\n{"score":70}\n```').generateText("p")).toBe('{"score":70}');
        });

        it("AI 応答が「```」で始まり「```」で終わるコードブロックで囲まれた「plain text」のとき、得られるテキストは「plain text」になる", async () => {
          expect(await makeClient("```\nplain text\n```").generateText("p")).toBe("plain text");
        });

        it('AI 応答が {"score":70} でコードブロックで囲まれていないとき、得られるテキストは {"score":70} になる', async () => {
          expect(await makeClient('{"score":70}').generateText("p")).toBe('{"score":70}');
        });

        it("AI 応答の末尾にだけ「```」がある「text```」のとき、得られるテキストは「text」になる", async () => {
          expect(await makeClient("text```").generateText("p")).toBe("text");
        });
      });

      describe("異常系", () => {
        it.each([
          ["応答の candidates が空である", []],
          ["応答の candidates に content が無い", [{}]],
          ["応答の content に parts が無い", [{ content: {} }]],
          ["応答の parts が空である", [{ content: { parts: [] } }]],
          ["応答の parts のテキストが空文字である", [{ content: { parts: [{ text: "" }] } }]],
        ])("%sとき、AI 応答が空であることを示すエラーになる", async (_situation, candidates) => {
          await expect(makeClientWithCandidates(candidates).generateText("p")).rejects.toThrow(
            /empty response/,
          );
        });
      });
    });
  });
});
