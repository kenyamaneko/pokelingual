import api from "./api";

/** /usage エンドポイントのレスポンス形。当日のカウントと上限を返す。 */
export interface DailyUsage {
  count: number;
  limit: number;
}

/** 当日利用状況エンドポイントを呼ぶ API クライアント。 */
export const usageApi = {
  get: () => api.get<DailyUsage>("/usage"),
};
