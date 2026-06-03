import { describe, it, expect, vi, afterEach } from "vitest";
import type { AxiosAdapter, AxiosResponse } from "axios";
import api from "./client";
import { type RateLimitDetail } from "../utils/rateLimitEvents";
import { spyOnRateLimitEvents } from "../test/rateLimitEventCapture";

/**
 * api/client (axios インスタンス) の仕様:
 * - mock モードでは Authorization: Bearer dev-token を自動付与する
 * - 429 レスポンスを受けたら rateLimitEvents に kind/message 付きで通知する
 * - 429 レスポンスのスキーマが不正なら通知せず、診断ログのみ出す
 *
 * vitest 環境は VITE_APP_MODE=mock のため isDevMode=true で動作する。
 * 本番認証トークン経路の検証は firebase mock が必要なため本ユニットでは対象外とする。
 */

// 元のアダプタを保存し、各テストでスタブに差し替える
const originalAdapter = api.defaults.adapter;

function installAdapter(adapter: AxiosAdapter) {
  api.defaults.adapter = adapter;
}

function statusAdapter(status: number, data: unknown): AxiosAdapter {
  return async (config) => {
    const response: AxiosResponse = {
      data,
      status,
      statusText: "",
      headers: {},
      config,
    };
    // axios は 2xx/3xx 以外をエラーとして reject する
    const err = new Error("request failed") as Error & { response: AxiosResponse; isAxiosError: boolean };
    err.response = response;
    err.isAxiosError = true;
    throw err;
  };
}

describe("api/client の仕様", () => {
  afterEach(() => {
    api.defaults.adapter = originalAdapter;
    vi.restoreAllMocks();
  });

  it("mock モードで Authorization: Bearer dev-token を自動付与する", async () => {
    let capturedAuth: string | undefined;
    installAdapter(async (config) => {
      capturedAuth = config.headers?.Authorization?.toString();
      return {
        data: {},
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      } as AxiosResponse;
    });

    await api.get("/anything");

    expect(capturedAuth).toBe("Bearer dev-token");
  });

  it("429 + 正しいスキーマで rateLimit イベントが発火する", async () => {
    installAdapter(statusAdapter(429, { error: "user", message: "上限に たっしました" }));
    const handler = spyOnRateLimitEvents();

    await expect(api.get("/anything")).rejects.toBeDefined();

    expect(handler).toHaveBeenCalledOnce();
    const detail = (handler.mock.calls[0][0] as CustomEvent<RateLimitDetail>).detail;
    expect(detail).toEqual({ kind: "user", message: "上限に たっしました" });
  });

  it.each([
    { name: "error が想定外の値", body: { error: "invalid", message: "x" } },
    { name: "message が欠落", body: { error: "user" } },
  ])("429 だが $name のとき通知せず、診断ログを出す", async ({ body }) => {
    installAdapter(statusAdapter(429, body));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = spyOnRateLimitEvents();

    await expect(api.get("/anything")).rejects.toBeDefined();

    expect(handler).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });

  it("429 以外のエラーでは rateLimit イベントを発火しない", async () => {
    installAdapter(statusAdapter(500, { error: "internal" }));
    const handler = spyOnRateLimitEvents();

    await expect(api.get("/anything")).rejects.toBeDefined();

    expect(handler).not.toHaveBeenCalled();
  });
});
