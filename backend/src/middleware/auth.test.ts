import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import type { Auth, DecodedIdToken } from "firebase-admin/auth";
import { firebaseAuth } from "./auth.js";

function stubAuthClient(verifyIdToken: () => Promise<Partial<DecodedIdToken>>): Auth {
  return { verifyIdToken } as unknown as Auth;
}

function makeReqRes(authorization?: string) {
  const status = vi.fn().mockReturnThis();
  const json = vi.fn().mockReturnThis();
  const req = {
    headers: authorization === undefined ? {} : { authorization },
  } as Request;
  const res = { status, json, locals: {} } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next, status, json };
}

describe("[認証] API リクエストの認証", () => {
  describe("正常系", () => {
    it("メール確認済みのトークンを送ると、リクエストは通過する", async () => {
      const mw = firebaseAuth(
        stubAuthClient(async () => ({ uid: "user-1", email: "anyone@example.com", email_verified: true })),
      );
      const { req, res, next, status } = makeReqRes("Bearer dummy-token");

      await mw(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(status).not.toHaveBeenCalled();
    });

    it("メール確認済みのトークンを送ると、後続の処理から見たユーザー ID はトークンに記録されたユーザー ID になる", async () => {
      const mw = firebaseAuth(
        stubAuthClient(async () => ({ uid: "user-1", email: "anyone@example.com", email_verified: true })),
      );
      const { req, res, next } = makeReqRes("Bearer dummy-token");

      await mw(req, res, next);

      expect(res.locals.userId).toBe("user-1");
    });
  });

  describe("異常系", () => {
    it("認証情報が無いとき、リクエストは 401 で拒否され、認証情報が無い旨が返る", async () => {
      const mw = firebaseAuth(stubAuthClient(async () => ({ uid: "user-1" })));
      const { req, res, next, status, json } = makeReqRes();

      await mw(req, res, next);

      expect(status).toHaveBeenLastCalledWith(401);
      expect(json).toHaveBeenLastCalledWith({ error: "missing authorization header" });
      expect(next).not.toHaveBeenCalled();
    });

    it("認証情報の形式が正しくないとき、リクエストは 401 で拒否され、認証情報の形式が正しくない旨が返る", async () => {
      const mw = firebaseAuth(stubAuthClient(async () => ({ uid: "user-1" })));
      const { req, res, next, status, json } = makeReqRes("Basic dummy-credential");

      await mw(req, res, next);

      expect(status).toHaveBeenLastCalledWith(401);
      expect(json).toHaveBeenLastCalledWith({ error: "invalid authorization format" });
      expect(next).not.toHaveBeenCalled();
    });

    it("トークンの検証に失敗したとき、リクエストは 401 で拒否され、トークンが無効である旨が返る", async () => {
      const mw = firebaseAuth(
        stubAuthClient(async () => {
          throw new Error("token expired");
        }),
      );
      const { req, res, next, status, json } = makeReqRes("Bearer dummy-token");

      await mw(req, res, next);

      expect(status).toHaveBeenLastCalledWith(401);
      expect(json).toHaveBeenLastCalledWith({ error: "invalid token" });
      expect(next).not.toHaveBeenCalled();
    });

    it.each([
      ["メール確認済みかどうかの情報が無いトークン", { uid: "user-1", email: "no-claim@example.com" }],
      ["メール未確認のトークン", { uid: "user-1", email: "unverified@example.com", email_verified: false }],
    ])("%s のとき、リクエストは 403 で拒否され、メール未確認である旨が返る", async (_given, token) => {
      const mw = firebaseAuth(stubAuthClient(async () => token));
      const { req, res, next, status, json } = makeReqRes("Bearer dummy-token");

      await mw(req, res, next);

      expect(status).toHaveBeenLastCalledWith(403);
      expect(json).toHaveBeenLastCalledWith({ error: "email not verified" });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
