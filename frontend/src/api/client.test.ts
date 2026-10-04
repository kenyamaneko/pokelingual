import { describe, it, expect, vi, afterEach } from "vitest";
import type { AxiosAdapter, AxiosResponse } from "axios";
import api from "./client";
import { type RateLimitDetail } from "../utils/rateLimitEvents";
import { spyOnRateLimitEvents } from "../test/rateLimitEventCapture";

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
    // axios は 2xx/3xx 以外をエラーとして reject するため、ここで投げる
    const err = new Error("request failed") as Error & { response: AxiosResponse; isAxiosError: boolean };
    err.response = response;
    err.isAxiosError = true;
    throw err;
  };
}

afterEach(() => {
  api.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});

describe("[認証] バックエンド呼び出しへの認証トークンの付与", () => {
  describe("正常系", () => {
    it("mock モードのとき、バックエンドへリクエストを送ると、リクエストに開発用トークンが付与される", async () => {
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
  });
});

describe("[レート制限・利用回数] 利用上限の通知", () => {
  describe("異常系", () => {
    describe("バックエンドが 429 を返したとき", () => {
      describe("応答が個人または全体の日次上限エラーの形式のとき", () => {
        describe.each([
          ["個人", "user"],
          ["全体", "global"],
        ] as const)("%sの日次上限エラーのとき", (label, kind) => {
          async function requestWithLimitError() {
            installAdapter(statusAdapter(429, { error: kind, message: "上限に たっしました" }));
            const handler = spyOnRateLimitEvents();

            await expect(api.get("/anything")).rejects.toBeDefined();

            expect(handler).toHaveBeenCalledOnce();
            return (handler.mock.calls[0][0] as CustomEvent<RateLimitDetail>).detail;
          }

          it(`利用上限の通知を受け取る側に、${label}の上限であることが届く`, async () => {
            const detail = await requestWithLimitError();

            expect(detail.kind).toBe(kind);
          });

          it("利用上限の通知を受け取る側に、上限エラーのメッセージが届く", async () => {
            const detail = await requestWithLimitError();

            expect(detail.message).toBe("上限に たっしました");
          });
        });
      });

      describe("応答の上限の種類またはメッセージが不正なとき", () => {
        const malformedBodies = [
          [
            "上限の種類が個人でも全体でもないとき",
            "上限エラーの形式が想定外であることを示す",
            { error: "invalid", message: "x" },
            "unexpected 429 response shape from backend",
          ],
          [
            "メッセージが無いとき",
            "上限エラーにメッセージが無いことを示す",
            { error: "user" },
            "429 response missing message field",
          ],
        ] as const;

        it.each(malformedBodies)(
          "%s、利用上限の通知を受け取る側には何も届かない",
          async (_given, _description, body) => {
            installAdapter(statusAdapter(429, body));
            vi.spyOn(console, "error").mockImplementation(() => {});
            const handler = spyOnRateLimitEvents();

            await expect(api.get("/anything")).rejects.toBeDefined();

            expect(handler).not.toHaveBeenCalled();
          },
        );

        it.each(malformedBodies)(
          "%s、コンソールに、%s エラーが出力される",
          async (_given, _description, body, logMessage) => {
            installAdapter(statusAdapter(429, body));
            const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

            await expect(api.get("/anything")).rejects.toBeDefined();

            expect(errorSpy).toHaveBeenCalledOnce();
            expect(errorSpy.mock.calls[0][0]).toBe(logMessage);
          },
        );
      });
    });

    it("バックエンドが 500 を返したとき、利用上限の通知を受け取る側には何も届かない", async () => {
      installAdapter(statusAdapter(500, { error: "internal" }));
      const handler = spyOnRateLimitEvents();

      await expect(api.get("/anything")).rejects.toBeDefined();

      expect(handler).not.toHaveBeenCalled();
    });
  });
});
