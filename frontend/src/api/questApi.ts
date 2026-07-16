import api from "./client";
import type {
  QuestNewResponse,
  QuestLocationsResponse,
  ScoreResponse,
  GuessResponse,
  SkipGuessResponse,
  CaptureResponse,
  HintResponse,
} from "../../../shared/api-types/quest";

/** useQuest が依存する quest API の形。 */
export interface QuestApi {
  getLocations: () => Promise<{ data: QuestLocationsResponse }>;
  newQuest: (locationId: string) => Promise<{ data: QuestNewResponse }>;
  scoreTranslation: (translation: string) => Promise<{ data: ScoreResponse }>;
  guessName: (guess: string) => Promise<{ data: GuessResponse }>;
  requestHint: () => Promise<{ data: HintResponse }>;
  skipGuess: () => Promise<{ data: SkipGuessResponse }>;
  attemptCapture: () => Promise<{ data: CaptureResponse }>;
}

/**
 * 指定プレフィックスのクエストエンドポイント (場所選択・出題・採点・推測・捕獲) を呼ぶ API クライアントを作る。
 * @param basePath エンドポイントのプレフィックス (本番は /quest、チュートリアルは /tutorial/quest)。
 * @returns QuestApi 実装。
 */
export function createQuestApi(basePath: string): QuestApi {
  return {
    getLocations: () => api.get<QuestLocationsResponse>(`${basePath}/locations`),
    newQuest: (locationId: string) =>
      api.get<QuestNewResponse>(`${basePath}/new`, { params: { location: locationId } }),
    scoreTranslation: (translation: string) =>
      api.post<ScoreResponse>(`${basePath}/score`, { translation }),
    guessName: (guess: string) => api.post<GuessResponse>(`${basePath}/guess-name`, { guess }),
    requestHint: () => api.post<HintResponse>(`${basePath}/hint`),
    skipGuess: () => api.post<SkipGuessResponse>(`${basePath}/skip-guess`),
    attemptCapture: () => api.post<CaptureResponse>(`${basePath}/capture`),
  };
}

/** 本番クエストの API クライアント。 */
export const questApi: QuestApi = createQuestApi("/quest");

/** チュートリアルの API クライアント。本番と同じロジックにチュートリアル用アダプタを組み合わせた backend を叩く。 */
export const tutorialQuestApi: QuestApi = createQuestApi("/tutorial/quest");
