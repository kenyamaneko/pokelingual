import type { Request, Response } from "express";
import type { UserRepository } from "../domain/ports.js";
import type { TutorialStatusResponse } from "../../../shared/api-types/tutorial.js";
import { handleError } from "./error.js";

/** チュートリアル完了フラグのエンドポイントを束ねるハンドラ。 */
export class TutorialHandler {
  /**
   * @param userRepo ユーザ本体リポジトリ。
   */
  constructor(private userRepo: UserRepository) {}

  /**
   * GET /tutorial-status — ユーザ自身のチュートリアル完了状態を返す。
   * @param req Express リクエスト。
   * @param res Express レスポンス。
   */
  getStatus = async (req: Request, res: Response) => {
    const userId = res.locals.userId as string;
    try {
      const user = await this.userRepo.getUser(userId);
      const body: TutorialStatusResponse = { tutorial_completed: user.tutorial_completed };
      res.json(body);
    } catch (err) {
      handleError(res, err, req.path);
    }
  };

  /**
   * PUT /tutorial-status/complete — チュートリアル完了フラグを立てる。
   * @param req Express リクエスト。
   * @param res Express レスポンス。
   */
  markCompleted = async (req: Request, res: Response) => {
    const userId = res.locals.userId as string;
    try {
      await this.userRepo.markTutorialCompleted(userId);
      res.json({ status: "ok" });
    } catch (err) {
      handleError(res, err, req.path);
    }
  };

  /**
   * PUT /tutorial-status/reset — チュートリアル完了フラグを未完了に戻す。
   * 実環境の E2E がチュートリアル未完了の状態を毎回用意できるようにするため、利用者自身の資格で呼べる。
   * @param req Express リクエスト。
   * @param res Express レスポンス。
   */
  reset = async (req: Request, res: Response) => {
    const userId = res.locals.userId as string;
    try {
      await this.userRepo.resetTutorialCompleted(userId);
      res.json({ status: "ok" });
    } catch (err) {
      handleError(res, err, req.path);
    }
  };
}
