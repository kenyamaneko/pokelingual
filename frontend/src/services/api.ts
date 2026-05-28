import axios from "axios";
import { auth, isDevMode } from "../config/firebase";
import {
  RATE_LIMIT_EVENT,
  rateLimitEvents,
  type RateLimitDetail,
  type RateLimitKind,
} from "./rateLimitEvents";

/** バックエンド API への共通 axios クライアント。認証トークン付与とレート制限通知のインターセプタを持つ。 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL + "/api",
});

api.interceptors.request.use(async (config) => {
  if (isDevMode) {
    config.headers.Authorization = "Bearer dev-token";
    return config;
  }
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (axios.isAxiosError(err) && err.response?.status === 429) {
      const data = err.response.data as { error?: string; message?: string };
      const detail: RateLimitDetail = {
        kind: (data.error === "global" ? "global" : "user") as RateLimitKind,
        message: data.message ?? "きょうの　じょうげんに　たっしました",
      };
      rateLimitEvents.dispatchEvent(new CustomEvent(RATE_LIMIT_EVENT, { detail }));
    }
    return Promise.reject(err);
  },
);

export default api;
