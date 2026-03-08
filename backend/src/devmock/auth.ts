import type { Request, Response, NextFunction } from "express";

export function devAuth() {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.locals.uid = "dev-user";
    next();
  };
}
