import api from "./client";
import type {
  QuestNewResponse,
  QuestLocationsResponse,
  ScoreResponse,
  GuessResponse,
  SkipGuessResponse,
  CaptureResponse,
} from "../../../shared/api-types/quest";

/**
 * useQuest が依存する quest API の形。本番の HTTP 実装 (questApi) と、
 * チュートリアルのインメモリ実装 (createTutorialQuestApi) が満たす契約。
 * 各メソッドの振る舞いは実装側の docs を参照する。
 */
export interface QuestApi {
  getLocations: () => Promise<{ data: QuestLocationsResponse }>;
  newQuest: (locationId: string) => Promise<{ data: QuestNewResponse }>;
  scoreTranslation: (translation: string) => Promise<{ data: ScoreResponse }>;
  guessName: (guess: string) => Promise<{ data: GuessResponse }>;
  skipGuess: () => Promise<{ data: SkipGuessResponse }>;
  attemptCapture: () => Promise<{ data: CaptureResponse }>;
}

/** クエスト関連エンドポイント (場所選択・出題・採点・推測・捕獲) を呼ぶ API クライアント。 */
export const questApi: QuestApi = {
  /**
   * GET /quest/locations — 場所選択の候補を取得する。
   * @returns 場所候補レスポンス。
   */
  getLocations: () => api.get<QuestLocationsResponse>("/quest/locations"),
  /**
   * GET /quest/new — 選んだ場所で新しい出題ポケモンを取得する。
   * @param locationId 選んだ探索場所 ID。
   * @returns 出題レスポンス。
   */
  newQuest: (locationId: string) =>
    api.get<QuestNewResponse>("/quest/new", { params: { location: locationId } }),
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
   * POST /quest/skip-guess — 名前当てをスキップする。
   * @returns スキップ結果 (常に poke)。
   */
  skipGuess: () => api.post<SkipGuessResponse>("/quest/skip-guess"),
  /**
   * POST /quest/capture — 捕獲を試行する。
   * @returns 捕獲結果レスポンス。
   */
  attemptCapture: () => api.post<CaptureResponse>("/quest/capture"),
};
