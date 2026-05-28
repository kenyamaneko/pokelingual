import api from "./api";

export interface DailyUsage {
  count: number;
  limit: number;
}

export const usageApi = {
  get: () => api.get<DailyUsage>("/usage"),
};
