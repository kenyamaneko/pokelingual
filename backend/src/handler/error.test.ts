import { describe, it, expect, vi } from "vitest";
import type { Response } from "express";
import { handleError } from "./error.js";
import {
  NotFoundError,
  ExternalServiceError,
  RateLimitError,
} from "../domain/errors.js";

// HTTP エラー応答の仕様
function makeRes() {
  const status = vi.fn().mockReturnThis();
  const json = vi.fn().mockReturnThis();
  return { status, json, res: { status, json } as unknown as Response };
}

describe("handleError の HTTP マッピング仕様", () => {
  it("NotFoundError は 404 を返す", () => {
    const { status, res } = makeRes();
    handleError(res, new NotFoundError("missing"), "/x");
    expect(status).toHaveBeenCalledWith(404);
  });

  it("ExternalServiceError は 502 を返す", () => {
    const { status, res } = makeRes();
    handleError(res, new ExternalServiceError("pokeapi", new Error("boom")), "/x");
    expect(status).toHaveBeenCalledWith(502);
  });

  it("RateLimitError(user) は 429 を返し、ユーザー向けメッセージを含む", () => {
    const { status, json, res } = makeRes();
    handleError(res, new RateLimitError("user"), "/x");
    expect(status).toHaveBeenCalledWith(429);
    const body = json.mock.calls[0][0] as { error: string; message: string };
    expect(body.error).toBe("user");
    expect(body.message).toBeTruthy();
  });

  it("RateLimitError(global) は 429 を返し、kind=global で出し分けされる", () => {
    const { status, json, res } = makeRes();
    handleError(res, new RateLimitError("global"), "/x");
    expect(status).toHaveBeenCalledWith(429);
    const body = json.mock.calls[0][0] as { error: string; message: string };
    expect(body.error).toBe("global");
  });

  it("user と global でメッセージは異なる", () => {
    const { json: userJson, res: userRes } = makeRes();
    const { json: globalJson, res: globalRes } = makeRes();
    handleError(userRes, new RateLimitError("user"), "/x");
    handleError(globalRes, new RateLimitError("global"), "/x");
    const userMsg = (userJson.mock.calls[0][0] as { message: string }).message;
    const globalMsg = (globalJson.mock.calls[0][0] as { message: string }).message;
    expect(userMsg).not.toBe(globalMsg);
  });

  it("未知のエラーは 500 を返す", () => {
    const { status, res } = makeRes();
    handleError(res, new Error("unexpected"), "/x");
    expect(status).toHaveBeenCalledWith(500);
  });
});
