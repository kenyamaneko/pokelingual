import api from "./client";
import type { DailyUsage } from "../../../shared/api-types/usage";

// UsageContext から `import { DailyUsage } from "../api/usageApi"` で参照されているため、ここで再 export する。
export type { DailyUsage };

/** 当日利用状況エンドポイントを呼ぶ API クライアント。 */
export const usageApi = {
  get: () => api.get<DailyUsage>("/usage"),
};
