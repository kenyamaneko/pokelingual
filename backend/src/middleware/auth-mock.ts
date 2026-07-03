import type { Request, Response, NextFunction } from "express";

/**
 * 認証をスキップして固定 userId="dev-user" を割り当てる開発用ミドルウェアを返す。
 * @returns res.locals.userId に "dev-user" を設定する Express ミドルウェア。
 */
export function devAuth() {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.locals.userId = "dev-user";
    next();
  };
}
