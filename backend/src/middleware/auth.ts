import type { Request, Response, NextFunction } from "express";
import type { Auth } from "firebase-admin/auth";
import { logger } from "../util/logger.js";
import type { ErrorResponse } from "../../../shared/api-types/error.js";

/**
 * Firebase ID トークンを検証し、メール確認済みならば userId を res.locals に格納するミドルウェアを返す。
 * @param authClient Firebase Admin の Auth クライアント。
 * @returns 認証を行う Express ミドルウェア。
 */
export function firebaseAuth(authClient: Auth) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ error: "missing authorization header" } satisfies ErrorResponse);
      return;
    }

    if (!authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "invalid authorization format" } satisfies ErrorResponse);
      return;
    }

    const idToken = authHeader.slice(7);

    try {
      const token = await authClient.verifyIdToken(idToken);

      // 未確認メールのトークンを直接送っての利用を防ぐ。メール/パスワードは確認完了まで
      // email_verified=false、Google サインインは常に true のため !== true で未確認を弾く。
      if (token.email_verified !== true) {
        res.status(403).json({ error: "email not verified" } satisfies ErrorResponse);
        return;
      }

      res.locals.userId = token.uid;
      next();
    } catch (err) {
      logger.warn("token verification failed", { error: String(err) });
      res.status(401).json({ error: "invalid token" } satisfies ErrorResponse);
    }
  };
}
