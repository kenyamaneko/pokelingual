/** レート制限の到達種別。"user" は個人上限、"global" はサービス全体上限。 */
export type RateLimitKind = "user" | "global";

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
