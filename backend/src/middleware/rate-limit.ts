import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { RateLimitRepository } from "../domain/ports.js";
import { handleError } from "../handler/error.js";

/**
 * RateLimitRepository を介してリクエストを検証・カウントするミドルウェアを返す。
 * @param repo 日次レート制限カウンタのリポジトリ。
 * @returns 上限内なら next、超過なら 429 を返す Express ミドルウェア。
 */
export function rateLimit(repo: RateLimitRepository): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const uid = res.locals.uid as string;
    try {
      await repo.checkAndIncrement(uid);
      next();
    } catch (err) {
      handleError(res, err, req.path);
    }
  };
}
