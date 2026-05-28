import type { Request, Response, NextFunction } from "express";
import type { Auth } from "firebase-admin/auth";

/** Firebase ID トークンを検証し、許可メールならば uid を res.locals に格納するミドルウェアを返す。 */
export function firebaseAuth(authClient: Auth, allowedEmails: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ error: "missing authorization header" });
      return;
    }

    if (!authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "invalid authorization format" });
      return;
    }

    const idToken = authHeader.slice(7);

    try {
      const token = await authClient.verifyIdToken(idToken);

      if (allowedEmails.length > 0) {
        const email = token.email ?? "";
        if (!allowedEmails.includes(email)) {
          res.status(403).json({ error: "access denied" });
          return;
        }
      }

      res.locals.uid = token.uid;
      next();
    } catch {
      res.status(401).json({ error: "invalid token" });
    }
  };
}
