import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import type { Auth, DecodedIdToken } from "firebase-admin/auth";
import { firebaseAuth } from "./auth.js";

// HTTP 境界での仕様: トークン検証と許可リスト判定の結果をレスポンスで確かめる。
// Firebase Auth は外部境界なので verifyIdToken だけをスタブに差し替える。

/**
 * verifyIdToken の挙動だけを差し替えた Auth クライアントのスタブを作る。
 * @param verifyIdToken トークン検証の代替実装。
 * @returns firebaseAuth に渡す Auth クライアントスタブ。
 */
function stubAuthClient(verifyIdToken: () => Promise<Partial<DecodedIdToken>>): Auth {
  return { verifyIdToken } as unknown as Auth;
}

/**
 * リクエスト・レスポンスのスタブを組み立てる。
 * @param authorization Authorization ヘッダ値 (省略時はヘッダ無し)。
 * @returns req / res / next とアサーション用の spy。
 */
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

describe("firebaseAuth ミドルウェア", () => {
  it("Authorization ヘッダが無ければ 401 で拒否する", async () => {
    const mw = firebaseAuth(stubAuthClient(async () => ({ uid: "user-1" })), []);
    const { req, res, next, status } = makeReqRes();

    await mw(req, res, next);

    expect(status).toHaveBeenLastCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("Bearer 形式でないヘッダは 401 で拒否する", async () => {
    const mw = firebaseAuth(stubAuthClient(async () => ({ uid: "user-1" })), []);
    const { req, res, next, status } = makeReqRes("Basic dummy-credential");

    await mw(req, res, next);

    expect(status).toHaveBeenLastCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("トークン検証に失敗したら 401 で拒否する", async () => {
    const mw = firebaseAuth(
      stubAuthClient(async () => {
        throw new Error("token expired");
      }),
      [],
    );
    const { req, res, next, status } = makeReqRes("Bearer dummy-token");

    await mw(req, res, next);

    expect(status).toHaveBeenLastCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("許可リストが空 (公開モード) なら認証だけで通過し、後続で userId が使える", async () => {
    const mw = firebaseAuth(
      stubAuthClient(async () => ({ uid: "user-1", email: "anyone@example.com" })),
      [],
    );
    const { req, res, next, status } = makeReqRes("Bearer dummy-token");

    await mw(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(status).not.toHaveBeenCalled();
    expect(res.locals.userId).toBe("user-1");
  });

  it("許可リストに含まれる email は通過し、後続で userId が使える", async () => {
    const mw = firebaseAuth(
      stubAuthClient(async () => ({ uid: "user-1", email: "allowed@example.com" })),
      ["allowed@example.com"],
    );
    const { req, res, next, status } = makeReqRes("Bearer dummy-token");

    await mw(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(status).not.toHaveBeenCalled();
    expect(res.locals.userId).toBe("user-1");
  });

  it("許可リストに含まれない email は 403 で拒否する", async () => {
    const mw = firebaseAuth(
      stubAuthClient(async () => ({ uid: "user-1", email: "other@example.com" })),
      ["allowed@example.com"],
    );
    const { req, res, next, status } = makeReqRes("Bearer dummy-token");

    await mw(req, res, next);

    expect(status).toHaveBeenLastCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("許可リスト運用時、email クレームの無いトークンは 403 で拒否する", async () => {
    const mw = firebaseAuth(stubAuthClient(async () => ({ uid: "user-1" })), [
      "allowed@example.com",
    ]);
    const { req, res, next, status } = makeReqRes("Bearer dummy-token");

    await mw(req, res, next);

    expect(status).toHaveBeenLastCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
