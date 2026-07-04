import type { Request, Response } from "express";
import type { RateLimitRepository } from "../domain/ports.js";
import { handleError } from "./error.js";

/** 当日の API 利用状況を返すエンドポイント用ハンドラ。 */
export class UsageHandler {
  /**
   * @param repo 日次レート制限カウンタのリポジトリ。
   */
  constructor(private repo: RateLimitRepository) {}

  /**
   * GET /usage — ユーザの当日リクエスト数と上限を返す。
   * @param req Express リクエスト。
   * @param res Express レスポンス。
   */
  getUsage = async (req: Request, res: Response) => {
    const userId = res.locals.userId as string;
    try {
      const usage = await this.repo.getUserUsage(userId);
      res.json(usage);
    } catch (err) {
      handleError(res, err, req.path);
    }
  };
}
