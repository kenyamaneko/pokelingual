import { describe, expect } from "vitest";
import type { VertexAI } from "@google-cloud/vertexai";
import { GeminiClient } from "./gemini.js";
import { defineCase, type Viewpoint } from "../../test/defineCase.js";

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

const REQUEST_TEXT_GENERATION = "クエストの翻訳を採点するために、AI にテキストの生成を依頼して、AI 応答からテキストを取り出す";

describe("[外部連携:AI]AI 応答からのテキスト取り出し", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: 'AI 応答が「```json」で始まり「```」で終わるコードブロックで囲まれた {"score":70} のとき',
          When: [REQUEST_TEXT_GENERATION],
          Then: '得られるテキストは {"score":70} になる',
        },
      ],
    },
    async () => {
      expect(await makeClient('```json\n{"score":70}\n```').generateText("p")).toBe('{"score":70}');
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "AI 応答が「```」で始まり「```」で終わるコードブロックで囲まれた「plain text」のとき",
          When: [REQUEST_TEXT_GENERATION],
          Then: "得られるテキストは「plain text」になる",
        },
      ],
    },
    async () => {
      expect(await makeClient("```\nplain text\n```").generateText("p")).toBe("plain text");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: 'AI 応答が {"score":70} でコードブロックで囲まれていないとき',
          When: [REQUEST_TEXT_GENERATION],
          Then: '得られるテキストは {"score":70} になる',
        },
      ],
    },
    async () => {
      expect(await makeClient('{"score":70}').generateText("p")).toBe('{"score":70}');
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["エッジケース"],
      steps: [
        {
          Given: "AI 応答の末尾にだけ「```」がある「text```」のとき",
          When: [REQUEST_TEXT_GENERATION],
          Then: "得られるテキストは「text」になる",
        },
      ],
    },
    async () => {
      expect(await makeClient("text```").generateText("p")).toBe("text");
    },
  );

  const EMPTY_RESPONSE_CASES: { situation: string; candidates: unknown[]; 観点: readonly Viewpoint[] }[] = [
    { situation: "応答の candidates が空である", candidates: [], 観点: ["外部依存の失敗", "件数・有無"] },
    { situation: "応答の candidates に content が無い", candidates: [{}], 観点: ["外部依存の失敗", "件数・有無", "エッジケース"] },
    { situation: "応答の content に parts が無い", candidates: [{ content: {} }], 観点: ["外部依存の失敗", "件数・有無", "エッジケース"] },
    { situation: "応答の parts が空である", candidates: [{ content: { parts: [] } }], 観点: ["外部依存の失敗", "件数・有無"] },
    { situation: "応答の parts のテキストが空文字である", candidates: [{ content: { parts: [{ text: "" }] } }], 観点: ["外部依存の失敗", "件数・有無"] },
  ];

  for (const { situation, candidates, 観点 } of EMPTY_RESPONSE_CASES) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "異常系",
        観点,
        steps: [
          { Given: `${situation}とき`, When: [REQUEST_TEXT_GENERATION], Then: "AI 応答が空であることを示すエラーになる" },
        ],
      },
      async () => {
        await expect(makeClientWithCandidates(candidates).generateText("p")).rejects.toThrow(/empty response/);
      },
    );
  }
});
