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

const CALL_SCORING = "翻訳の採点 API を呼び出す";
const WITHIN_DAILY_LIMIT = "今日の AI 呼び出し回数が日次上限以内のとき";
const REJECTED_USER_LIMIT = "API の応答は、ユーザーの日次上限に達したことを示す 429 のエラーになる";
const REJECTED_GLOBAL_LIMIT = "API の応答は、全体の日次上限に達したことを示す 429 のエラーになる";
const PASSED = "API の応答は 200 になる";

describe("[本体:AI 呼び出し回数]日次上限以内の通過", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: WITHIN_DAILY_LIMIT,
          When: [CALL_SCORING],
          Then: PASSED,
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
      steps: [{ Given: "ユーザーの日次上限に達しているとき", When: [CALL_SCORING], Then: REJECTED_USER_LIMIT }],
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
          Given: "ユーザーの日次上限に達しているとき",
          When: [CALL_SCORING],
          Then: "応答のメッセージは「そろそろ　研究に　戻るぞ。また　明日　来てくれ」になる",
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
      観点: ["回復確認"],
      steps: [
        { Given: "ユーザーの日次上限に達しているとき", When: [CALL_SCORING], Then: REJECTED_USER_LIMIT },
        { Given: WITHIN_DAILY_LIMIT, When: [CALL_SCORING], Then: PASSED },
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
      steps: [{ Given: "全体の日次上限に達しているとき", When: [CALL_SCORING], Then: REJECTED_GLOBAL_LIMIT }],
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
      観点: ["回復確認"],
      steps: [
        { Given: "全体の日次上限に達しているとき", When: [CALL_SCORING], Then: REJECTED_GLOBAL_LIMIT },
        { Given: WITHIN_DAILY_LIMIT, When: [CALL_SCORING], Then: PASSED },
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
