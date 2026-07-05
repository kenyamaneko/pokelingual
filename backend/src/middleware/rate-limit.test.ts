import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { rateLimit } from "./rate-limit.js";
import { RateLimitError } from "../domain/errors.js";
import type { DailyUsage, RateLimitRepository } from "../domain/ports.js";

// HTTP 境界での仕様: 上限以内は通し、超えたら 429 を返す。
// Repo 自体の挙動はリポジトリ層のコントラクトテストでカバーする前提で、ここではミドルウェアの
// HTTP マッピングだけ検証する。Repo は最小スタブで差し替えて副作用を排除する。
function makeReqRes() {
  const status = vi.fn().mockReturnThis();
  const json = vi.fn().mockReturnThis();
  const req = { path: "/api/quest/score" } as Request;
  const res = { status, json, locals: { userId: "alice" } } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next, status, json };
}

/** 渡した checkAndIncrement の挙動だけを差し替える最小スタブ。 */
function stubRepo(checkAndIncrement: RateLimitRepository["checkAndIncrement"]): RateLimitRepository {
  return {
    checkAndIncrement,
    getUserUsage: async (): Promise<DailyUsage> => ({ count: 0, limit: 100 }),
  };
}

describe("rate-limit ミドルウェア", () => {
  it("上限内なら次のハンドラに進む（next が呼ばれる）", async () => {
    const mw = rateLimit(stubRepo(async () => ({ count: 1, limit: 3 })));
    const { req, res, next, status } = makeReqRes();

    await mw(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(status).not.toHaveBeenCalled();
  });

  it("ユーザー上限超過時は 429 を返し、kind=user を含む", async () => {
    const mw = rateLimit(stubRepo(async () => { throw new RateLimitError("user"); }));
    const { req, res, next, status, json } = makeReqRes();

    await mw(req, res, next);

    expect(status).toHaveBeenLastCalledWith(429);
    expect(json).toHaveBeenLastCalledWith(expect.objectContaining({ error: "user" }));
    expect(next).not.toHaveBeenCalled();
  });

  it("全体上限超過時は 429 を返し、kind=global を含む", async () => {
    const mw = rateLimit(stubRepo(async () => { throw new RateLimitError("global"); }));
    const { req, res, next, status, json } = makeReqRes();

    await mw(req, res, next);

    expect(status).toHaveBeenLastCalledWith(429);
    expect(json).toHaveBeenLastCalledWith(expect.objectContaining({ error: "global" }));
  });

  it("429 レスポンスにはユーザー向けメッセージが含まれる", async () => {
    const mw = rateLimit(stubRepo(async () => { throw new RateLimitError("user"); }));
    const { req, res, next, json } = makeReqRes();

    await mw(req, res, next);

    const body = json.mock.calls[0][0] as { message: string };
    expect(body.message).toBeTruthy();
    expect(body.message.length).toBeGreaterThan(5);
  });
});
