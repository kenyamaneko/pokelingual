import type { Request, Response, NextFunction } from "express";

/**
 * 認証をスキップして固定 uid="dev-user" を割り当てる開発用ミドルウェアを返す。
 * @returns res.locals.uid に "dev-user" を設定する Express ミドルウェア。
 */
export function devAuth() {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.locals.uid = "dev-user";
    next();
  };
}
