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

const GENERATE_TEXT = "AI にプロンプトを送って、テキストを生成する";

describe("[外部連携:AI]AI の回答からのテキスト取り出し", () => {
  for (const { given, response } of [
    {
      given: 'AI の回答が「```json」で始まり「```」で終わるコードブロックで囲まれた {"score":70} のとき',
      response: '```json\n{"score":70}\n```',
    },
    { given: 'AI の回答が {"score":70} でコードブロックで囲まれていないとき', response: '{"score":70}' },
  ]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        steps: [{ Given: given, When: [GENERATE_TEXT], Then: '生成したテキストは {"score":70} になる' }],
      },
      async () => {
        expect(await makeClient(response).generateText("p")).toBe('{"score":70}');
      },
    );
  }

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "AI の回答が「```」で始まり「```」で終わるコードブロックで囲まれた「plain text」のとき",
          When: [GENERATE_TEXT],
          Then: "生成したテキストは「plain text」になる",
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
      観点: ["エッジケース"],
      steps: [
        {
          Given: "AI の回答の末尾にだけ「```」がある「text```」のとき",
          When: [GENERATE_TEXT],
          Then: "生成したテキストは「text」になる",
        },
      ],
    },
    async () => {
      expect(await makeClient("text```").generateText("p")).toBe("text");
    },
  );

  const EMPTY_RESPONSE_CASES: { given: string; candidates: unknown[]; 観点: readonly Viewpoint[] }[] = [
    { given: "AI の回答の候補が 0 件のとき", candidates: [], 観点: ["外部依存の失敗", "件数・有無"] },
    { given: "AI の回答の候補に内容が無いとき", candidates: [{}], 観点: ["外部依存の失敗", "件数・有無", "エッジケース"] },
    { given: "AI の回答の候補の内容に本文の部分が無いとき", candidates: [{ content: {} }], 観点: ["外部依存の失敗", "件数・有無", "エッジケース"] },
    { given: "AI の回答の候補の本文の部分が 0 件のとき", candidates: [{ content: { parts: [] } }], 観点: ["外部依存の失敗", "件数・有無"] },
    { given: "AI の回答の本文が空文字であるとき", candidates: [{ content: { parts: [{ text: "" }] } }], 観点: ["外部依存の失敗", "件数・有無"] },
  ];

  for (const { given, candidates, 観点 } of EMPTY_RESPONSE_CASES) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "異常系",
        観点,
        steps: [
          { Given: given, When: [GENERATE_TEXT], Then: "AI の回答が空であることを示すエラーになる" },
        ],
      },
      async () => {
        await expect(makeClientWithCandidates(candidates).generateText("p")).rejects.toThrow(/empty response/);
      },
    );
  }
});
