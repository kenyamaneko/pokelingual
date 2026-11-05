import { describe, expect } from "vitest";
import express from "express";
import request from "supertest";
import { rateLimit } from "./rate-limit.js";
import { RateLimitError } from "../domain/errors.js";
import type { RateLimitKind } from "../domain/errors.js";
import type { DailyUsage, RateLimitRepository } from "../domain/ports.js";
import { defineCase } from "../test/defineCase.js";

function stubRepo(checkAndIncrement: RateLimitRepository["checkAndIncrement"]): RateLimitRepository {
  return {
    checkAndIncrement,
    getUserUsage: async (): Promise<DailyUsage> => ({ count: 0, limit: 100 }),
  };
}

function makeApp(checkAndIncrement: RateLimitRepository["checkAndIncrement"]) {
  const app = express();
  app.use((_req, res, next) => {
    res.locals.userId = "alice";
    next();
  });
  app.post("/api/quest/score", rateLimit(stubRepo(checkAndIncrement)), (_req, res) => {
    res.status(200).json({ reached: true });
  });
  return app;
}

function rejectOnlyFirstRequest(kind: RateLimitKind): RateLimitRepository["checkAndIncrement"] {
  let isFirstRequest = true;
  return async () => {
    if (isFirstRequest) {
      isFirstRequest = false;
      throw new RateLimitError(kind);
    }
    return { count: 1, limit: 3 };
  };
}

const SEND_REQUEST = "クエスト画面の翻訳の採点を依頼して、AI 呼び出し回数の日次上限を確認する";
const REJECTED_USER_LIMIT = "リクエストは 429 で拒否され、ユーザーの日次上限に達した旨が返る";
const REJECTED_GLOBAL_LIMIT = "リクエストは 429 で拒否され、全体の日次上限に達した旨が返る";
const RECOVERED = "リクエストは 200 で後続の処理に渡される";

describe("[本体:AI 呼び出し回数]日次上限以内の通過", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "今日の AI 呼び出し回数が日次上限以内のとき",
          When: [SEND_REQUEST],
          Then: "リクエストは後続の処理に渡される",
        },
      ],
    },
    async () => {
      const app = makeApp(async () => ({ count: 1, limit: 3 }));

      const res = await request(app).post("/api/quest/score");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ reached: true });
    },
  );
});

describe("[本体:AI 呼び出し回数]ユーザーごとの日次上限超過の拒否", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [{ Given: "ユーザーの日次上限を超えているとき", When: [SEND_REQUEST], Then: REJECTED_USER_LIMIT }],
    },
    async () => {
      const app = makeApp(async () => {
        throw new RateLimitError("user");
      });

      const res = await request(app).post("/api/quest/score");

      expect(res.status).toBe(429);
      expect(res.body.error).toBe("user");
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: "ユーザーの日次上限を超えているとき",
          When: [SEND_REQUEST],
          Then: "429 の応答に、「そろそろ　研究に　戻るぞ。また　明日　来てくれ」というユーザー向けメッセージが含まれる",
        },
      ],
    },
    async () => {
      const app = makeApp(async () => {
        throw new RateLimitError("user");
      });

      const res = await request(app).post("/api/quest/score");

      expect(res.body.message).toBe("そろそろ　研究に　戻るぞ。また　明日　来てくれ");
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [
        { Given: "ユーザーの日次上限を超えているとき", When: [SEND_REQUEST], Then: REJECTED_USER_LIMIT },
        { Given: "次の依頼時には日次上限以内であるとき", When: ["クエスト画面の翻訳の採点をもう一度依頼して、AI 呼び出し回数の日次上限を確認する"], Then: RECOVERED },
      ],
    },
    async () => {
      const app = makeApp(rejectOnlyFirstRequest("user"));

      const rejected = await request(app).post("/api/quest/score");
      expect(rejected.status).toBe(429);
      expect(rejected.body.error).toBe("user");

      const recovered = await request(app).post("/api/quest/score");
      expect(recovered.status).toBe(200);
      expect(recovered.body).toEqual({ reached: true });
    },
  );
});

describe("[本体:AI 呼び出し回数]全体の日次上限超過の拒否", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [{ Given: "全体の日次上限を超えているとき", When: [SEND_REQUEST], Then: REJECTED_GLOBAL_LIMIT }],
    },
    async () => {
      const app = makeApp(async () => {
        throw new RateLimitError("global");
      });

      const res = await request(app).post("/api/quest/score");

      expect(res.status).toBe(429);
      expect(res.body.error).toBe("global");
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [
        { Given: "全体の日次上限を超えているとき", When: [SEND_REQUEST], Then: REJECTED_GLOBAL_LIMIT },
        { Given: "次の依頼時には日次上限以内であるとき", When: ["クエスト画面の翻訳の採点をもう一度依頼して、AI 呼び出し回数の日次上限を確認する"], Then: RECOVERED },
      ],
    },
    async () => {
      const app = makeApp(rejectOnlyFirstRequest("global"));

      const rejected = await request(app).post("/api/quest/score");
      expect(rejected.status).toBe(429);
      expect(rejected.body.error).toBe("global");

      const recovered = await request(app).post("/api/quest/score");
      expect(recovered.status).toBe(200);
      expect(recovered.body).toEqual({ reached: true });
    },
  );
});
