import type { Request, Response } from "express";
import type { RateLimitRepository } from "../domain/ports.js";
import { handleError } from "./error.js";

/** 当日の API 利用状況を返すエンドポイント用ハンドラ。 */
export class UsageHandler {
  constructor(private repo: RateLimitRepository) {}

  /** GET /usage — ユーザの当日リクエスト数と上限を返す。 */
  getUsage = async (req: Request, res: Response) => {
    const uid = res.locals.uid as string;
    try {
      const usage = await this.repo.getUserUsage(uid);
      res.json(usage);
    } catch (err) {
      handleError(res, err, req.path);
    }
  };
}
