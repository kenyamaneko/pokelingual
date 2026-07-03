import axios from "axios";
import { auth, isDevMode } from "../firebase";
import {
  RATE_LIMIT_EVENT,
  rateLimitEvents,
  type RateLimitDetail,
} from "../utils/rateLimitEvents";
import { logger } from "../utils/logger";

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
      if (data.error !== "user" && data.error !== "global") {
        logger.error("unexpected 429 response shape from backend", { response_body: data });
      } else if (!data.message) {
        logger.error("429 response missing message field", { response_body: data });
      } else {
        const detail: RateLimitDetail = { kind: data.error, message: data.message };
        rateLimitEvents.dispatchEvent(new CustomEvent(RATE_LIMIT_EVENT, { detail }));
      }
    }
    return Promise.reject(err);
  },
);

export default api;
