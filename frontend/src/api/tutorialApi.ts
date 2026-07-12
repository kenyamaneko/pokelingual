import api from "./client";
import type { TutorialStatusResponse } from "../../../shared/api-types/tutorial";

/** チュートリアル完了フラグエンドポイントを呼ぶ API クライアント。 */
export const tutorialApi = {
  /**
   * GET /tutorial-status — チュートリアル完了状態を取得する。
   * @returns チュートリアル状態レスポンス。
   */
  getStatus: () => api.get<TutorialStatusResponse>("/tutorial-status"),
  /**
   * PUT /tutorial-status/complete — チュートリアル完了フラグを立てる。
   * @returns 更新結果のレスポンス。
   */
  markCompleted: () => api.put("/tutorial-status/complete"),
};
