import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import type { Auth, DecodedIdToken } from "firebase-admin/auth";
import { firebaseAuth } from "./auth.js";

function stubAuthClient(verifyIdToken: () => Promise<Partial<DecodedIdToken>>): Auth {
  return { verifyIdToken } as unknown as Auth;
}

function makeApp(authClient: Auth) {
  const app = express();
  app.get("/api/quest/score", firebaseAuth(authClient), (_req, res) => {
    res.status(200).json({ reached: true, userId: res.locals.userId });
  });
  return app;
}

describe("[本体:認証]API リクエストの認証", () => {
  describe("メール確認済みのトークンを送ったとき", () => {
    describe("単体テスト", () => {
      describe("正常系", () => {
        it("リクエストは後続の処理に渡される", async () => {
          const app = makeApp(
            stubAuthClient(async () => ({ uid: "user-1", email: "anyone@example.com", email_verified: true })),
          );

          const res = await request(app).get("/api/quest/score").set("Authorization", "Bearer dummy-token");

          expect(res.status).toBe(200);
          expect(res.body.reached).toBe(true);
        });

        it("トークンに記録されたユーザー ID が user-1 のとき、後続の処理から見たユーザー ID は user-1 になる", async () => {
          const app = makeApp(
            stubAuthClient(async () => ({ uid: "user-1", email: "anyone@example.com", email_verified: true })),
          );

          const res = await request(app).get("/api/quest/score").set("Authorization", "Bearer dummy-token");

          expect(res.body.userId).toBe("user-1");
        });
      });
    });
  });

  describe("単体テスト", () => {
    describe("異常系", () => {
      it("Authorization ヘッダが無いとき、リクエストは 401 で拒否され、認証情報が無い旨が返る", async () => {
        const app = makeApp(stubAuthClient(async () => ({ uid: "user-1" })));

        const res = await request(app).get("/api/quest/score");

        expect(res.status).toBe(401);
        expect(res.body).toEqual({ error: "missing authorization header" });
      });

      it("Authorization ヘッダの値が Basic 形式のとき、リクエストは 401 で拒否され、認証情報の形式が正しくない旨が返る", async () => {
        const app = makeApp(stubAuthClient(async () => ({ uid: "user-1" })));

        const res = await request(app).get("/api/quest/score").set("Authorization", "Basic dummy-credential");

        expect(res.status).toBe(401);
        expect(res.body).toEqual({ error: "invalid authorization format" });
      });

      it("トークンの検証に失敗したとき、リクエストは 401 で拒否され、トークンが無効である旨が返る", async () => {
        const app = makeApp(
          stubAuthClient(async () => {
            throw new Error("token expired");
          }),
        );

        const res = await request(app).get("/api/quest/score").set("Authorization", "Bearer dummy-token");

        expect(res.status).toBe(401);
        expect(res.body).toEqual({ error: "invalid token" });
      });
    });
  });

  describe("Bearer 形式でトークンを送ると", () => {
    describe("単体テスト", () => {
      describe("異常系", () => {
        it.each([
          { given: "メール確認済みかどうかの情報が無いトークン", token: { uid: "user-1", email: "no-claim@example.com" } },
          {
            given: "メール未確認のトークン",
            token: { uid: "user-1", email: "unverified@example.com", email_verified: false },
          },
        ])("$given のとき、リクエストは 403 で拒否され、メール未確認である旨が返る", async ({ token }) => {
          const app = makeApp(stubAuthClient(async () => token));

          const res = await request(app).get("/api/quest/score").set("Authorization", "Bearer dummy-token");

          expect(res.status).toBe(403);
          expect(res.body).toEqual({ error: "email not verified" });
        });
      });
    });
  });
});
