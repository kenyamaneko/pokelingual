import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, vi, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import api from "../api/client";
import { useUsage } from "./UsageContext";
import { server, apiUrl, countRequests } from "../test/mswServer";
import { renderWithProviders } from "../test/render";
import type { User } from "firebase/auth";
import { defineCase } from "../test/defineCase";

/**
 * バックエンドが AI 呼び出し回数と上限を返す状態にする。
 * @param count 当日の AI 呼び出し回数。
 * @param limit 上限。
 */
function mockUsage(count: number, limit: number) {
  server.use(http.get(apiUrl("/usage"), () => HttpResponse.json({ count, limit })));
}

function Probe() {
  const { usage } = useUsage();
  return <div>{usage ? `${usage.count}/${usage.limit}` : "未取得"}</div>;
}

function LimitTrigger() {
  return (
    <button
      onClick={() => {
        api.get("/limited").catch(() => {});
      }}
    >
      日次上限に達する操作
    </button>
  );
}

const fakeUser = { uid: "alice" } as unknown as User;

function renderUsage(user: User | null = fakeUser) {
  return renderWithProviders(<Probe />, { user });
}

const START_UP = "アプリを起動して、ヘッダーに残り回数を表示するために AI 呼び出し回数を取得する";
const LOGGED_OUT = "未ログインのとき";
const USAGE_NOT_FETCHED = "AI 呼び出し回数の表示が「未取得」のままになる";

describe("[本体:AI 呼び出し回数]AI 呼び出し回数の記録と取得", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "ログインしていて、バックエンドが AI 呼び出し回数 3、日次上限 30 を返すとき",
          When: [START_UP],
          Then: "AI 呼び出し回数の表示が「3/30」になる",
        },
      ],
    },
    async () => {
      mockUsage(3, 30);

      renderUsage();

      expect(await screen.findByText("3/30")).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [{ Given: LOGGED_OUT, When: [START_UP], Then: USAGE_NOT_FETCHED }],
    },
    async () => {
      renderUsage(null);

      expect(await screen.findByText("未取得")).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [{ Given: LOGGED_OUT, When: [START_UP], Then: "バックエンドの「/usage」へのリクエストは 0 件のままになる" }],
    },
    async () => {
      renderUsage(null);
      await screen.findByText("未取得");

      expect(countRequests("/usage")).toBe(0);
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      観点: ["外部依存の失敗"],
      steps: [
        {
          Given: "ログインしていて、バックエンドの AI 呼び出し回数の取得が通信エラーで失敗するとき",
          When: [START_UP],
          Then: USAGE_NOT_FETCHED,
        },
      ],
    },
    async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      server.use(http.get(apiUrl("/usage"), () => HttpResponse.error()));

      renderUsage();

      await waitFor(() => expect(warnSpy).toHaveBeenCalled());
      expect(screen.getByText("未取得")).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      観点: ["外部依存の失敗", "回復確認"],
      steps: [
        {
          Given:
            "ログインしていて、バックエンドの AI 呼び出し回数の取得が最初は通信エラーで失敗し、日次上限に達する操作に 429 を返し、その後の取得で AI 呼び出し回数 30、日次上限 30 を返すとき",
          When: [START_UP, "AI を呼び出す画面で「日次上限に達する操作」ボタンを押す"],
          Then: "AI 呼び出し回数の表示が「30/30」になる",
        },
      ],
    },
    async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      server.use(
        http.get(apiUrl("/usage"), () => HttpResponse.error(), { once: true }),
        http.get(apiUrl("/usage"), () => HttpResponse.json({ count: 30, limit: 30 })),
        http.get(apiUrl("/limited"), () =>
          HttpResponse.json({ error: "user", message: "上限に たっしました" }, { status: 429 }),
        ),
      );
      const user = userEvent.setup();
      renderWithProviders(
        <>
          <Probe />
          <LimitTrigger />
        </>,
        { user: fakeUser },
      );
      await waitFor(() => expect(warnSpy).toHaveBeenCalled());

      await user.click(screen.getByRole("button", { name: "日次上限に達する操作" }));

      expect(await screen.findByText("30/30")).toBeInTheDocument();
    },
  );
});
