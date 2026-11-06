import { describe, expect } from "vitest";
import express from "express";
import request from "supertest";
import type { Auth, DecodedIdToken } from "firebase-admin/auth";
import { firebaseAuth } from "./auth.js";
import { defineCase } from "../test/defineCase.js";

function stubAuthClient(verifyIdToken: () => Promise<Partial<DecodedIdToken>>): Auth {
  return { verifyIdToken } as unknown as Auth;
}

function makeApp(authClient: Auth) {
  const app = express();
  const router = express.Router();
  router.use(firebaseAuth(authClient));
  router.get("/quest/score", (_req, res) => {
    res.status(200).json({ reached: true, userId: res.locals.userId });
  });
  app.use("/api", router);
  return app;
}

const CALL_WITH_BEARER_TOKEN = "ログインが必要な API に、Bearer 形式のトークンを指定して呼び出す";
const CALL_API = "ログインが必要な API を呼び出す";
const VERIFIED_TOKEN = "トークンがメール確認済みのとき";

describe("[共通:認証]API リクエストの認証", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: VERIFIED_TOKEN,
          When: [CALL_WITH_BEARER_TOKEN],
          Then: "API の応答は 200 になる",
        },
      ],
    },
    async () => {
      const app = makeApp(
        stubAuthClient(async () => ({ uid: "user-1", email: "anyone@example.com", email_verified: true })),
      );

      const res = await request(app).get("/api/quest/score").set("Authorization", "Bearer dummy-token");

      expect(res.status).toBe(200);
      expect(res.body.reached).toBe(true);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "メール確認済みのトークンに記録されたユーザー ID が user-1 のとき",
          When: [CALL_WITH_BEARER_TOKEN],
          Then: "API の応答のユーザー ID は user-1 になる",
        },
      ],
    },
    async () => {
      const app = makeApp(
        stubAuthClient(async () => ({ uid: "user-1", email: "anyone@example.com", email_verified: true })),
      );

      const res = await request(app).get("/api/quest/score").set("Authorization", "Bearer dummy-token");

      expect(res.body.userId).toBe("user-1");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: "Authorization ヘッダが無いとき",
          When: [CALL_API],
          Then: "API の応答は、認証情報が無いことを示す 401 のエラーになる",
        },
      ],
    },
    async () => {
      const app = makeApp(stubAuthClient(async () => ({ uid: "user-1" })));

      const res = await request(app).get("/api/quest/score");

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: "missing authorization header" });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: "Authorization ヘッダの値が Basic 形式のとき",
          When: [CALL_API],
          Then: "API の応答は、認証情報の形式が正しくないことを示す 401 のエラーになる",
        },
      ],
    },
    async () => {
      const app = makeApp(stubAuthClient(async () => ({ uid: "user-1" })));

      const res = await request(app).get("/api/quest/score").set("Authorization", "Basic dummy-credential");

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: "invalid authorization format" });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: "トークンが期限切れのとき",
          When: [CALL_WITH_BEARER_TOKEN],
          Then: "API の応答は、トークンが無効であることを示す 401 のエラーになる",
        },
      ],
    },
    async () => {
      const app = makeApp(
        stubAuthClient(async () => {
          throw new Error("token expired");
        }),
      );

      const res = await request(app).get("/api/quest/score").set("Authorization", "Bearer dummy-token");

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: "invalid token" });
    },
  );

  for (const { given, token } of [
    { given: "メール確認済みかどうかの情報が無いトークンのとき", token: { uid: "user-1", email: "no-claim@example.com" } },
    {
      given: "メール未確認のトークンのとき",
      token: { uid: "user-1", email: "unverified@example.com", email_verified: false },
    },
  ]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "異常系",
        steps: [
          {
            Given: given,
            When: [CALL_WITH_BEARER_TOKEN],
            Then: "API の応答は、メール未確認であることを示す 403 のエラーになる",
          },
        ],
      },
      async () => {
        const app = makeApp(stubAuthClient(async () => token));

        const res = await request(app).get("/api/quest/score").set("Authorization", "Bearer dummy-token");

        expect(res.status).toBe(403);
        expect(res.body).toEqual({ error: "email not verified" });
      },
    );
  }
});
