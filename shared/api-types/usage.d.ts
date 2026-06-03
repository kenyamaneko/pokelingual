/**
 * Pokelingual の利用状況 API 契約型。両側で import type する SSOT。
 */

/** GET /api/usage のレスポンス。当日のカウントと上限。 */
export interface DailyUsage {
  count: number;
  limit: number;
}
