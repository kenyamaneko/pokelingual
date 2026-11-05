import { describe, expect, vi, afterEach } from "vitest";
import type { AxiosAdapter, AxiosResponse } from "axios";
import api from "./client";
import { type RateLimitDetail } from "../utils/rateLimitEvents";
import { spyOnRateLimitEvents } from "../test/rateLimitEventCapture";
import { defineCase } from "../test/defineCase";

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

async function requestWithLimitError(kind: string): Promise<RateLimitDetail> {
  installAdapter(statusAdapter(429, { error: kind, message: "上限に たっしました" }));
  const handler = spyOnRateLimitEvents();

  await expect(api.get("/anything")).rejects.toMatchObject({ response: { status: 429 } });

  expect(handler).toHaveBeenCalledOnce();
  return (handler.mock.calls[0][0] as CustomEvent<RateLimitDetail>).detail;
}

const SEND_REQUEST = "バックエンドへリクエストを送る";
const SEND_REQUEST_AGAIN = "もう一度バックエンドへリクエストを送る";
const NOTHING_NOTIFIED = "日次上限の通知を受け取る側には何も届かない";
const INVALID_KIND_429 = "バックエンドが 429 を返し、上限の種類が「invalid」でユーザーでも全体でもないとき";
const USER_KIND_429 = "バックエンドが 429 を返し、上限の種類がユーザーのとき";
const USER_LIMIT_NOTIFIED = "日次上限の通知を受け取る側に、ユーザーの日次上限であることが届く";

describe("[本体:認証]バックエンド呼び出しへの認証トークンの付与", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "VITE_APP_MODE が mock のとき",
          When: [SEND_REQUEST],
          Then: "リクエストの Authorization ヘッダーが「Bearer dev-token」になる",
        },
      ],
    },
    async () => {
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
    },
  );
});

describe("[本体:AI 呼び出し回数]日次上限の通知", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [{ Given: USER_KIND_429, When: [SEND_REQUEST], Then: USER_LIMIT_NOTIFIED }],
    },
    async () => {
      const detail = await requestWithLimitError("user");

      expect(detail.kind).toBe("user");
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: "バックエンドが 429 を返し、上限の種類が全体のとき",
          When: [SEND_REQUEST],
          Then: "日次上限の通知を受け取る側に、全体の日次上限であることが届く",
        },
      ],
    },
    async () => {
      const detail = await requestWithLimitError("global");

      expect(detail.kind).toBe("global");
    },
  );

  for (const { label, kind } of [
    { label: "ユーザー", kind: "user" },
    { label: "全体", kind: "global" },
  ]) {
    defineCase(
      {
        種別: "部品間結合テスト",
        正常異常: "異常系",
        steps: [
          {
            Given: `バックエンドが 429 を返し、上限の種類が${label}で、応答のメッセージが「上限に たっしました」のとき`,
            When: [SEND_REQUEST],
            Then: "日次上限の通知を受け取る側に、メッセージ「上限に たっしました」が届く",
          },
        ],
      },
      async () => {
        const detail = await requestWithLimitError(kind);

        expect(detail.message).toBe("上限に たっしました");
      },
    );
  }

  for (const { given, status, body } of [
    { given: INVALID_KIND_429, status: 429, body: { error: "invalid", message: "x" } },
    {
      given: "バックエンドが 429 を返し、上限の種類はユーザーで、メッセージが無いとき",
      status: 429,
      body: { error: "user" },
    },
    {
      given: "バックエンドが 429 を返し、上限の種類はユーザーで、メッセージが空文字のとき",
      status: 429,
      body: { error: "user", message: "" },
    },
    { given: "バックエンドが 500 を返したとき", status: 500, body: { error: "internal" } },
  ]) {
    defineCase(
      {
        種別: "部品間結合テスト",
        正常異常: "異常系",
        steps: [{ Given: given, When: [SEND_REQUEST], Then: NOTHING_NOTIFIED }],
      },
      async () => {
        installAdapter(statusAdapter(status, body));
        vi.spyOn(console, "error").mockImplementation(() => {});
        const handler = spyOnRateLimitEvents();

        await expect(api.get("/anything")).rejects.toMatchObject({ response: { status } });

        expect(handler).not.toHaveBeenCalled();
      },
    );
  }

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [
        { Given: INVALID_KIND_429, When: [SEND_REQUEST], Then: "リクエストは 429 のエラーになる" },
        { Given: USER_KIND_429, When: [SEND_REQUEST_AGAIN], Then: USER_LIMIT_NOTIFIED },
      ],
    },
    async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      installAdapter(statusAdapter(429, { error: "invalid", message: "x" }));
      await expect(api.get("/anything")).rejects.toMatchObject({ response: { status: 429 } });

      const detail = await requestWithLimitError("user");

      expect(detail.kind).toBe("user");
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [
        { Given: USER_KIND_429, When: [SEND_REQUEST], Then: USER_LIMIT_NOTIFIED },
        {
          Given: "バックエンドが 200 で応答のデータ「ok」を返すとき",
          When: [SEND_REQUEST_AGAIN],
          Then: "リクエストの結果は「ok」になる",
        },
      ],
    },
    async () => {
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
    },
  );
});

describe("[運用:ログ出力]不正な日次上限エラーのログ出力", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: INVALID_KIND_429,
          When: [SEND_REQUEST],
          Then: "コンソールのエラー出力に、メッセージ「unexpected 429 response shape from backend」が 1 回だけ出る",
        },
      ],
    },
    async () => {
      installAdapter(statusAdapter(429, { error: "invalid", message: "x" }));
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await expect(api.get("/anything")).rejects.toMatchObject({ response: { status: 429 } });

      expect(errorSpy).toHaveBeenCalledOnce();
      expect(errorSpy.mock.calls[0][0]).toBe("unexpected 429 response shape from backend");
    },
  );

  for (const { given, body } of [
    { given: "バックエンドが 429 を返し、上限の種類はユーザーで、メッセージが無いとき", body: { error: "user" } },
    {
      given: "バックエンドが 429 を返し、上限の種類はユーザーで、メッセージが空文字のとき",
      body: { error: "user", message: "" },
    },
  ]) {
    defineCase(
      {
        種別: "部品間結合テスト",
        正常異常: "異常系",
        steps: [
          {
            Given: given,
            When: [SEND_REQUEST],
            Then: "コンソールのエラー出力に、メッセージ「429 response missing message field」が 1 回だけ出る",
          },
        ],
      },
      async () => {
        installAdapter(statusAdapter(429, body));
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        await expect(api.get("/anything")).rejects.toMatchObject({ response: { status: 429 } });

        expect(errorSpy).toHaveBeenCalledOnce();
        expect(errorSpy.mock.calls[0][0]).toBe("429 response missing message field");
      },
    );
  }
});
