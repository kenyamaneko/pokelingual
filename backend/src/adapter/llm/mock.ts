import type { LLMClient } from "../../domain/ports.js";

/** モック採点で返すスコアの下限値。 */
const MOCK_SCORE_MIN = 20;
/** モック採点で返すスコアの最大値 (上限は MOCK_SCORE_MIN + MOCK_SCORE_RANGE - 1 = 95)。 */
const MOCK_SCORE_RANGE = 76;

/** 講評文を切り替えるスコア帯閾値。本番 Gemini の scoring guidelines と合わせている。 */
const REVIEW_THRESHOLDS = {
  excellent: 90,
  good: 70,
  partial: 50,
  attempted: 30,
} as const;

const MOCK_CHAT_REPLY =
  "なるほど いい 質問だな！この 文章の ポイントは 主語と 動詞の 関係だ。わからない ところが あれば 何でも 聞いてくれ！";

/**
 * Gemini を呼ばずに固定的なレスポンスを返す開発用 LLMClient 実装。
 *
 * モック仕様: プロンプトに含まれる識別子で用途を判定する。
 * - "translation evaluator" を含む → ScoreResult 形式の JSON を返す
 * - "Pokemon professor" を含む → 教授チャット風の固定文を返す
 * サービス側のプロンプトを変更する際は、いずれかのキーワードを必ず残すこと。
 */
export class MockLLMClient implements LLMClient {
  async generateText(prompt: string): Promise<string> {
    if (prompt.includes("translation evaluator")) {
      const score = MOCK_SCORE_MIN + Math.floor(Math.random() * MOCK_SCORE_RANGE);
      return JSON.stringify({ score, review: mockReview(score) });
    }
    if (prompt.includes("Pokemon professor")) {
      return MOCK_CHAT_REPLY;
    }
    throw new Error("MockLLMClient: prompt does not match any known task marker");
  }
}

function mockReview(score: number): string {
  if (score >= REVIEW_THRESHOLDS.excellent) return "素晴らしい！全体の 意味を 正確に 捉えているぞ。自然な 日本語で とても いい 翻訳だ！";
  if (score >= REVIEW_THRESHOLDS.good) return "よく 頑張ったな！意味は しっかり 伝わっているぞ。細かい ニュアンスを もう 少し 工夫すると さらに 良くなるぞ。";
  if (score >= REVIEW_THRESHOLDS.partial) return "いい 調子だ！前半は よく 訳せているぞ。「emit」は 放つ という 意味だ。難しい 単語は 博士に 聞いてくれ。";
  if (score >= REVIEW_THRESHOLDS.attempted) return "挑戦した ことが 大事だぞ！わからない 部分は 一緒に 学んでいこう。「fierce」は 激しい・獰猛な という 意味だ。";
  return "よく 挑戦したな！まずは 知っている 単語を 手がかりに 全体像を つかんでみよう。博士が 手伝うぞ。";
}
