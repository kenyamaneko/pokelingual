import type { Request, Response, NextFunction } from "express";
import type { Auth } from "firebase-admin/auth";
import { logger } from "../util/logger.js";
import type { ErrorResponse } from "../../../shared/api-types/error.js";

/**
 * Firebase ID トークンを検証し、メール確認済みかつ許可メールならば userId を res.locals に格納するミドルウェアを返す。
 * @param authClient Firebase Admin の Auth クライアント。
 * @param allowedEmails 許可メールのホワイトリスト (空なら公開モード)。
 * @returns 認証・認可を行う Express ミドルウェア。
 */
export function firebaseAuth(authClient: Auth, allowedEmails: string[]) {
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

      if (allowedEmails.length > 0) {
        // email クレームを持たないトークン (電話認証・匿名認証など) は本アプリ未対応のため拒否する
        if (!token.email || !allowedEmails.includes(token.email)) {
          res.status(403).json({ error: "access denied" } satisfies ErrorResponse);
          return;
        }
      }

      res.locals.userId = token.uid;
      next();
    } catch (err) {
      logger.warn("token verification failed", { error: String(err) });
      res.status(401).json({ error: "invalid token" } satisfies ErrorResponse);
    }
  };
}
