import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { RateLimitRepository } from "../domain/interfaces.js";
import { handleError } from "../handler/error.js";

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
