import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { rateLimit } from "./rate-limit.js";
import { MockRateLimitRepo } from "../devmock/rate-limit-repo.js";

// HTTP 境界での仕様: 上限以内は通し、超えたら 429 を返す
function makeReqRes() {
  const status = vi.fn().mockReturnThis();
  const json = vi.fn().mockReturnThis();
  const req = { path: "/api/quest/score" } as Request;
  const res = { status, json, locals: { uid: "alice" } } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next, status, json };
}

describe("rate-limit ミドルウェアの仕様", () => {
  it("上限内なら次のハンドラに進む（next が呼ばれる）", async () => {
    const repo = new MockRateLimitRepo(3, 100);
    const mw = rateLimit(repo);
    const { req, res, next, status } = makeReqRes();

    await mw(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(status).not.toHaveBeenCalled();
  });

  it("ユーザー上限超過時は 429 を返し、kind=user を含む", async () => {
    const repo = new MockRateLimitRepo(1, 100);
    const mw = rateLimit(repo);
    const { req, res, next, status, json } = makeReqRes();

    await mw(req, res, next);
    await mw(req, res, next);

    expect(status).toHaveBeenLastCalledWith(429);
    expect(json).toHaveBeenLastCalledWith(expect.objectContaining({ error: "user" }));
  });

  it("全体上限超過時は 429 を返し、kind=global を含む", async () => {
    const repo = new MockRateLimitRepo(100, 1);
    const aliceMw = rateLimit(repo);
    const { req: req1, res: res1, next: next1 } = makeReqRes();
    await aliceMw(req1, res1, next1);

    const { req: req2, res: res2, next: next2, status, json } = makeReqRes();
    (res2.locals as { uid: string }).uid = "bob";
    await aliceMw(req2, res2, next2);

    expect(status).toHaveBeenLastCalledWith(429);
    expect(json).toHaveBeenLastCalledWith(expect.objectContaining({ error: "global" }));
  });

  it("429 レスポンスにはユーザー向けメッセージが含まれる", async () => {
    const repo = new MockRateLimitRepo(0, 100);
    const mw = rateLimit(repo);
    const { req, res, next, json } = makeReqRes();

    await mw(req, res, next);

    const body = json.mock.calls[0][0] as { message: string };
    expect(body.message).toBeTruthy();
    expect(body.message.length).toBeGreaterThan(5);
  });
});
