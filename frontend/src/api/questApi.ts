import api from "./client";
import type {
  QuestNewResponse,
  ScoreResponse,
  GuessResponse,
  CaptureResponse,
  ChatContext,
  ChatMessage,
  ChatResponse,
} from "../../../shared/api-types/quest";

/** クエスト関連エンドポイント (出題・採点・推測・捕獲・チャット) を呼ぶ API クライアント。 */
export const questApi = {
  /**
   * GET /quest/new — 新しい出題ポケモンを取得する。
   * @returns 出題レスポンス。
   */
  newQuest: () => api.get<QuestNewResponse>("/quest/new"),
  /**
   * POST /quest/score — 翻訳を採点する。
   * @param translation ユーザの日本語訳。
   * @returns 採点レスポンス。
   */
  scoreTranslation: (translation: string) =>
    api.post<ScoreResponse>("/quest/score", { translation }),
  /**
   * POST /quest/guess-name — ポケモン名の推測を判定する。
   * @param guess ユーザの推測名。
   * @returns 判定レスポンス。
   */
  guessName: (guess: string) =>
    api.post<GuessResponse>("/quest/guess-name", { guess }),
  /**
   * POST /quest/capture — 捕獲を試行する。
   * @returns 捕獲結果レスポンス。
   */
  attemptCapture: () => api.post<CaptureResponse>("/quest/capture"),
  /**
   * POST /quest/chat — 教授チャットの応答を取得する。
   * @param context クエストの文脈。
   * @param messages 会話履歴。
   * @returns チャット応答レスポンス。
   */
  replyToChat: (context: ChatContext, messages: ChatMessage[]) =>
    api.post<ChatResponse>("/quest/chat", { context, messages }),
};
