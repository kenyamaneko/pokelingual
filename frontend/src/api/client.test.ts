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

describe("[本体:認証]バックエンド呼び出しへの認証トークンの付与", () => {
  describe("VITE_APP_MODE が mock のとき", () => {
    describe("部品間結合テスト", () => {
      describe("正常系", () => {
        it("バックエンドへリクエストを送ると、リクエストの Authorization ヘッダーが「Bearer dev-token」になる", async () => {
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
  });
});

async function requestWithLimitError(kind: string): Promise<RateLimitDetail> {
  installAdapter(statusAdapter(429, { error: kind, message: "上限に たっしました" }));
  const handler = spyOnRateLimitEvents();

  await expect(api.get("/anything")).rejects.toMatchObject({ response: { status: 429 } });

  expect(handler).toHaveBeenCalledOnce();
  return (handler.mock.calls[0][0] as CustomEvent<RateLimitDetail>).detail;
}

describe("[本体:AI 呼び出し回数]日次上限の通知", () => {
  describe("バックエンドが 429 を返したとき", () => {
    describe("応答がユーザーまたは全体の日次上限エラーの形式のとき", () => {
      describe("部品間結合テスト", () => {
        describe("異常系", () => {
          it("上限の種類がユーザーのとき、日次上限の通知を受け取る側に、ユーザーの日次上限であることが届く", async () => {
            const detail = await requestWithLimitError("user");

            expect(detail.kind).toBe("user");
          });

          it("上限の種類が全体のとき、日次上限の通知を受け取る側に、全体の日次上限であることが届く", async () => {
            const detail = await requestWithLimitError("global");

            expect(detail.kind).toBe("global");
          });

          it.each([
            ["ユーザー", "user"],
            ["全体", "global"],
          ])(
            "上限の種類が%sで、応答のメッセージが「上限に たっしました」のとき、日次上限の通知を受け取る側に、メッセージ「上限に たっしました」が届く",
            async (_label, kind) => {
              const detail = await requestWithLimitError(kind);

              expect(detail.message).toBe("上限に たっしました");
            },
          );
        });
      });
    });
  });

  describe("部品間結合テスト", () => {
    describe("異常系", () => {
      it.each([
        [
          "バックエンドが 429 を返し、上限の種類が「invalid」でユーザーでも全体でもないとき",
          429,
          { error: "invalid", message: "x" },
        ],
        ["バックエンドが 429 を返し、上限の種類はユーザーで、メッセージが無いとき", 429, { error: "user" }],
        [
          "バックエンドが 429 を返し、上限の種類はユーザーで、メッセージが空文字のとき",
          429,
          { error: "user", message: "" },
        ],
        ["バックエンドが 500 を返したとき", 500, { error: "internal" }],
      ])("%s、日次上限の通知を受け取る側には何も届かない", async (_given, status, body) => {
        installAdapter(statusAdapter(status, body));
        vi.spyOn(console, "error").mockImplementation(() => {});
        const handler = spyOnRateLimitEvents();

        await expect(api.get("/anything")).rejects.toMatchObject({ response: { status } });

        expect(handler).not.toHaveBeenCalled();
      });

      it("上限の種類が「invalid」の 429 を返したあと、上限の種類がユーザーの 429 を返すと、日次上限の通知を受け取る側に、ユーザーの日次上限であることが届く", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        installAdapter(statusAdapter(429, { error: "invalid", message: "x" }));
        await expect(api.get("/anything")).rejects.toMatchObject({ response: { status: 429 } });

        const detail = await requestWithLimitError("user");

        expect(detail.kind).toBe("user");
      });

      it("上限の種類がユーザーの 429 を返したあと、バックエンドが 200 で応答のデータ「ok」を返すと、リクエストの結果は「ok」になる", async () => {
        await requestWithLimitError("user");
        installAdapter(async (config) => ({
          data: "ok",
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        }));

        const response = await api.get("/anything");

        expect(response.data).toBe("ok");
      });
    });
  });
});

describe("[運用:AI 呼び出し回数]不正な日次上限エラーのログ出力", () => {
  describe("バックエンドが 429 を返したとき", () => {
    describe("部品間結合テスト", () => {
      describe("異常系", () => {
        it("上限の種類が「invalid」でユーザーでも全体でもないとき、コンソールのエラー出力に、メッセージ「unexpected 429 response shape from backend」が 1 回だけ出る", async () => {
          installAdapter(statusAdapter(429, { error: "invalid", message: "x" }));
          const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

          await expect(api.get("/anything")).rejects.toMatchObject({ response: { status: 429 } });

          expect(errorSpy).toHaveBeenCalledOnce();
          expect(errorSpy.mock.calls[0][0]).toBe("unexpected 429 response shape from backend");
        });

        it.each([
          ["上限の種類はユーザーで、メッセージが無いとき", { error: "user" }],
          ["上限の種類はユーザーで、メッセージが空文字のとき", { error: "user", message: "" }],
        ])(
          "%s、コンソールのエラー出力に、メッセージ「429 response missing message field」が 1 回だけ出る",
          async (_given, body) => {
            installAdapter(statusAdapter(429, body));
            const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

            await expect(api.get("/anything")).rejects.toMatchObject({ response: { status: 429 } });

            expect(errorSpy).toHaveBeenCalledOnce();
            expect(errorSpy.mock.calls[0][0]).toBe("429 response missing message field");
          },
        );
      });
    });
  });
});
