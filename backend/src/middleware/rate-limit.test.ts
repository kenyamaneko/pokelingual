import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { rateLimit } from "./rate-limit.js";
import { RateLimitError } from "../domain/errors.js";
import type { DailyUsage, RateLimitRepository } from "../domain/ports.js";

function makeReqRes() {
  const status = vi.fn().mockReturnThis();
  const json = vi.fn().mockReturnThis();
  const req = { path: "/api/quest/score" } as Request;
  const res = { status, json, locals: { userId: "alice" } } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next, status, json };
}

function stubRepo(checkAndIncrement: RateLimitRepository["checkAndIncrement"]): RateLimitRepository {
  return {
    checkAndIncrement,
    getUserUsage: async (): Promise<DailyUsage> => ({ count: 0, limit: 100 }),
  };
}

describe("[レート制限・利用回数] 利用上限の判定", () => {
  describe("正常系", () => {
    it("利用回数が上限以内のとき、リクエストは通過する", async () => {
      const mw = rateLimit(stubRepo(async () => ({ count: 1, limit: 3 })));
      const { req, res, next, status } = makeReqRes();

      await mw(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(status).not.toHaveBeenCalled();
    });
  });

  describe("異常系", () => {
    describe("個人の利用上限を超えたとき", () => {
      it("リクエストは 429 で拒否され、個人の上限に達した旨が返る", async () => {
        const mw = rateLimit(stubRepo(async () => { throw new RateLimitError("user"); }));
        const { req, res, next, status, json } = makeReqRes();

        await mw(req, res, next);

        expect(status).toHaveBeenLastCalledWith(429);
        expect(json).toHaveBeenLastCalledWith(expect.objectContaining({ error: "user" }));
        expect(next).not.toHaveBeenCalled();
      });

      it("429 の応答に、「そろそろ　研究に　戻るぞ。また　明日　来てくれ」というユーザー向けメッセージが含まれる", async () => {
        const mw = rateLimit(stubRepo(async () => { throw new RateLimitError("user"); }));
        const { req, res, next, json } = makeReqRes();

        await mw(req, res, next);

        expect(json).toHaveBeenLastCalledWith(
          expect.objectContaining({ message: "そろそろ　研究に　戻るぞ。また　明日　来てくれ" }),
        );
      });
    });

    it("全体の利用上限を超えたとき、リクエストは 429 で拒否され、全体の上限に達した旨が返る", async () => {
      const mw = rateLimit(stubRepo(async () => { throw new RateLimitError("global"); }));
      const { req, res, next, status, json } = makeReqRes();

      await mw(req, res, next);

      expect(status).toHaveBeenLastCalledWith(429);
      expect(json).toHaveBeenLastCalledWith(expect.objectContaining({ error: "global" }));
    });
  });
});
