/**
 * Pokelingual のチュートリアル完了フラグ API 契約型。両側で import type する SSOT。
 */

/** GET /api/tutorial-status のレスポンス。 */
export interface TutorialStatusResponse {
  tutorial_completed: boolean;
}
