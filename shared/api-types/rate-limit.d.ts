/**
 * Pokelingual のレート制限 API 契約型。両側で import type する SSOT。
 */

/** レート制限の到達種別。"user" は個人上限、"global" はサービス全体上限。 */
export type RateLimitKind = "user" | "global";

/** AI 呼び出し上限到達時に HTTP 429 で返すレスポンスボディ。 */
export interface RateLimitResponse {
  error: RateLimitKind;
  message: string;
}
