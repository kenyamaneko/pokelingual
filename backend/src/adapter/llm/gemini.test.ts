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

describe("[AI 呼び出し] AI 応答からのテキスト取り出し", () => {
  describe("AI にテキストの生成を依頼する", () => {
    describe("正常系", () => {
      it.each([
        ["```json", '```json\n{"score":70}\n```', '{"score":70}'],
        ["```", "```\nplain text\n```", "plain text"],
      ])(
        "AI 応答が %s で始まるコードブロックで囲まれているとき、得られるテキストは囲みを除いた本文になる",
        async (_opening, input, expected) => {
          expect(await makeClient(input).generateText("p")).toBe(expected);
        },
      );

      it("AI 応答がコードブロックで囲まれていないとき、得られるテキストは AI 応答の本文そのものになる", async () => {
        expect(await makeClient('{"score":70}').generateText("p")).toBe('{"score":70}');
      });

      it("AI 応答の末尾にだけ ``` があるとき、得られるテキストは末尾の ``` を除いた本文になる", async () => {
        expect(await makeClient("text```").generateText("p")).toBe("text");
      });
    });

    describe("異常系", () => {
      describe("AI 応答から生成されたテキストを取り出せないとき", () => {
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
