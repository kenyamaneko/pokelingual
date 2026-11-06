import { describe, expect, vi, afterEach } from "vitest";
import type { AxiosAdapter, AxiosResponse } from "axios";
import api from "./client";
import { type RateLimitDetail } from "../utils/rateLimitEvents";
import { spyOnRateLimitEvents } from "../test/rateLimitEventCapture";
import { defineCase, type Viewpoint } from "../test/defineCase";

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

const CALL_BACKEND_API = "バックエンドの API を呼び出す";
const NOTHING_NOTIFIED = "日次上限の通知は発行されない";
const INVALID_KIND_LIMIT = "日次上限に達していて、上限の種類が「invalid」でユーザーでも全体でもないとき";
const USER_LIMIT_REACHED = "ユーザーの日次上限に達しているとき";
const USER_LIMIT_NOTIFIED = "日次上限の通知の種類がユーザーになる";
const USER_LIMIT_WITHOUT_MESSAGE = "ユーザーの日次上限に達していて、メッセージが無いとき";
const USER_LIMIT_WITH_EMPTY_MESSAGE = "ユーザーの日次上限に達していて、メッセージが空文字のとき";

describe("[共通:認証]バックエンド呼び出しへの認証トークンの付与", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "VITE_APP_MODE が mock のとき",
          When: [CALL_BACKEND_API],
          Then: "送信するリクエストの Authorization ヘッダーが「Bearer dev-token」になる",
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
      steps: [{ Given: USER_LIMIT_REACHED, When: [CALL_BACKEND_API], Then: USER_LIMIT_NOTIFIED }],
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
          Given: "全体の日次上限に達しているとき",
          When: [CALL_BACKEND_API],
          Then: "日次上限の通知の種類が全体になる",
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
            Given: `${label}の日次上限に達していて、メッセージが「上限に たっしました」のとき`,
            When: [CALL_BACKEND_API],
            Then: "日次上限の通知のメッセージが「上限に たっしました」になる",
          },
        ],
      },
      async () => {
        const detail = await requestWithLimitError(kind);

        expect(detail.message).toBe("上限に たっしました");
      },
    );
  }

  const NOTHING_NOTIFIED_CASES: { given: string; status: number; body: unknown; 観点: readonly Viewpoint[] }[] = [
    { given: INVALID_KIND_LIMIT, status: 429, body: { error: "invalid", message: "x" }, 観点: ["エッジケース"] },
    {
      given: USER_LIMIT_WITHOUT_MESSAGE,
      status: 429,
      body: { error: "user" },
      観点: ["エッジケース", "件数・有無"],
    },
    {
      given: USER_LIMIT_WITH_EMPTY_MESSAGE,
      status: 429,
      body: { error: "user", message: "" },
      観点: ["エッジケース", "件数・有無"],
    },
    { given: "バックエンドでエラーが起きているとき", status: 500, body: { error: "internal" }, 観点: ["外部依存の失敗"] },
  ];

  for (const { given, status, body, 観点 } of NOTHING_NOTIFIED_CASES) {
    defineCase(
      {
        種別: "部品間結合テスト",
        正常異常: "異常系",
        観点,
        steps: [{ Given: given, When: [CALL_BACKEND_API], Then: NOTHING_NOTIFIED }],
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
      観点: ["エッジケース", "回復確認"],
      steps: [
        {
          Given: INVALID_KIND_LIMIT,
          When: [CALL_BACKEND_API],
          Then: "API の応答は、日次上限に達したことを示す 429 のエラーになる",
        },
        { Given: USER_LIMIT_REACHED, When: [CALL_BACKEND_API], Then: USER_LIMIT_NOTIFIED },
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
      観点: ["回復確認"],
      steps: [
        { Given: USER_LIMIT_REACHED, When: [CALL_BACKEND_API], Then: USER_LIMIT_NOTIFIED },
        {
          Given: "日次上限に達しておらず、応答のデータが「ok」のとき",
          When: [CALL_BACKEND_API],
          Then: "API の応答のデータが「ok」になる",
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
      観点: ["外部依存の失敗"],
      steps: [
        {
          Given: INVALID_KIND_LIMIT,
          When: [CALL_BACKEND_API],
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

  const MISSING_MESSAGE_CASES: { given: string; body: unknown; 観点: readonly Viewpoint[] }[] = [
    { given: USER_LIMIT_WITHOUT_MESSAGE, body: { error: "user" }, 観点: ["外部依存の失敗", "件数・有無"] },
    {
      given: USER_LIMIT_WITH_EMPTY_MESSAGE,
      body: { error: "user", message: "" },
      観点: ["外部依存の失敗", "件数・有無"],
    },
  ];

  for (const { given, body, 観点 } of MISSING_MESSAGE_CASES) {
    defineCase(
      {
        種別: "部品間結合テスト",
        正常異常: "異常系",
        観点,
        steps: [
          {
            Given: given,
            When: [CALL_BACKEND_API],
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
