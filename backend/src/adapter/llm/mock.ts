import type { LLMClient } from "../../domain/ports.js";

/** モック採点で返すスコアの下限値。 */
const MOCK_SCORE_MIN = 20;
/** モック採点で返すスコアの幅 (上限は MOCK_SCORE_MIN + MOCK_SCORE_RANGE - 1 = 95)。 */
const MOCK_SCORE_RANGE = 76;

/** 講評文を切り替えるスコア帯閾値。本番 Gemini の scoring guidelines と合わせている。 */
const REVIEW_THRESHOLDS = {
  excellent: 90,
  good: 70,
  partial: 50,
  attempted: 30,
} as const;

const MOCK_CHAT_REPLY =
  "これは モックの 返信だぞ！本番では 博士が 質問に 答えてくれる。わからない ところが あれば 何でも 聞いてくれ！";

/**
 * Gemini を呼ばずに固定的なレスポンスを返す開発用 LLMClient 実装。
 *
 * モック仕様: プロンプトに含まれる識別子で用途を判定する。
 * - "translation evaluator" を含む → ScoreResult 形式の JSON を返す
 * - "Pokemon professor" を含む → 教授チャット風の固定文を返す
 * サービス側のプロンプトを変更する際は、いずれかのキーワードを必ず残すこと。
 */
export class MockLLMClient implements LLMClient {
  /**
   * プロンプト内のキーワードで用途を判定し、固定レスポンスを返す。
   * @param prompt サービス側が組み立てたプロンプト文字列。
   * @returns 採点用 JSON 文字列 または 教授チャットの固定文。
   */
  async generateText(prompt: string): Promise<string> {
    if (prompt.includes("translation evaluator")) {
      const score = MOCK_SCORE_MIN + Math.floor(Math.random() * MOCK_SCORE_RANGE);
      return JSON.stringify({ score, review: buildMockReview(score) });
    }
    if (prompt.includes("Pokemon professor")) {
      return MOCK_CHAT_REPLY;
    }
    throw new Error("MockLLMClient: prompt does not match any known task marker");
  }
}

/**
 * スコア帯に応じたモック講評文を返す。
 * @param score 採点スコア (0-100)。
 * @returns スコア帯に対応する日本語の講評文。
 */
function buildMockReview(score: number): string {
  if (score >= REVIEW_THRESHOLDS.excellent) return "これは 最高評価用の モック講評だぞ！素晴らしい！全体の 意味を 正確に 捉えているぞ。";
  if (score >= REVIEW_THRESHOLDS.good) return "これは 高評価用の モック講評だぞ！意味は しっかり 伝わっているぞ。";
  if (score >= REVIEW_THRESHOLDS.partial) return "これは 中間評価用の モック講評だぞ！前半は よく 訳せているぞ。";
  if (score >= REVIEW_THRESHOLDS.attempted) return "これは 低評価用の モック講評だぞ！挑戦した ことが 大事だぞ！";
  return "これは 最低評価用の モック講評だぞ！まずは 知っている 単語を 手がかりに 全体像を つかんでみよう。";
}
