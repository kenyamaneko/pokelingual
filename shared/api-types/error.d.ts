/**
 * Pokelingual のエラーレスポンス API 契約型の SSOT。
 */

/** エラー時に HTTP 4xx/5xx で返す共通レスポンスボディ。レート制限 (429) のみ RateLimitResponse を返す。 */
export interface ErrorResponse {
  error: string;
}
