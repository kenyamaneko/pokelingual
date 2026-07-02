// RateLimitKind は 429 レスポンスの error フィールドに乗る wire 値なので、shared/api-types を SSOT として再 export する。
import type { RateLimitKind } from "../../../shared/api-types/rate-limit";
export type { RateLimitKind };

/** レート制限通知イベントのペイロード。表示メッセージと種別を含む。 */
export interface RateLimitDetail {
  kind: RateLimitKind;
  message: string;
}

/** レート制限到達を通知するイベントハブ。 */
// axios インターセプタから React 木の外で発火させるため EventTarget で橋渡しする
export const rateLimitEvents = new EventTarget();

/** rateLimitEvents で dispatch するイベント名。 */
export const RATE_LIMIT_EVENT = "rate-limit";
