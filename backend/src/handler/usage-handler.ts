import type { Request, Response } from "express";
import type { RateLimitRepository } from "../domain/interfaces.js";
import { handleError } from "./error.js";

export class UsageHandler {
  constructor(private repo: RateLimitRepository) {}

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
