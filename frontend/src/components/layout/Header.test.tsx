import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, vi, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import type { User } from "firebase/auth";
import type { DailyUsage } from "../../../../shared/api-types/usage";
import { QuestPage } from "../../pages/QuestPage";
import { server, apiUrl, countRequests } from "../../test/mswServer";
import { renderWithProviders } from "../../test/render";
import { submitTranslationForScoring } from "../../test/scoringFlow";
import { Header } from "./Header";
import { defineCase } from "../../test/defineCase";

const fakeUser = { uid: "alice" } as unknown as User;

function mockUsage(usage: DailyUsage) {
  server.use(http.get(apiUrl("/usage"), () => HttpResponse.json(usage)));
}

function renderHeader(user: User | null = fakeUser) {
  return renderWithProviders(<Header />, { user, withRouter: true });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const SHOW_HEADER = "ヘッダーを表示する";

describe("[本体:共通画面]実行環境の表示", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [{ Given: "ログインしていて、VITE_ENVIRONMENT が local のとき", When: [SHOW_HEADER], Then: "「LOCAL」と表示される" }],
    },
    async () => {
      vi.stubEnv("VITE_ENVIRONMENT", "local");
      mockUsage({ count: 0, limit: 30 });

      renderHeader();

      expect(await screen.findByText("LOCAL")).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [{ Given: "ログインしていて、VITE_ENVIRONMENT が dev のとき", When: [SHOW_HEADER], Then: "「DEV」と表示される" }],
    },
    async () => {
      vi.stubEnv("VITE_ENVIRONMENT", "dev");
      mockUsage({ count: 0, limit: 30 });

      renderHeader();

      expect(await screen.findByText("DEV")).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "ログインしていて、VITE_ENVIRONMENT が prod のとき",
          When: [SHOW_HEADER],
          Then: "「LOCAL」も「DEV」も表示されない",
        },
      ],
    },
    async () => {
      vi.stubEnv("VITE_ENVIRONMENT", "prod");
      mockUsage({ count: 0, limit: 30 });

      renderHeader();

      // 描画の完了を待ってから不在を確かめるため、残り回数の表示が出るのを待つ
      await screen.findByText("残り 30/30");
      expect(screen.queryByText("LOCAL")).not.toBeInTheDocument();
      expect(screen.queryByText("DEV")).not.toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: "ログインしていて、VITE_ENVIRONMENT が未設定のとき",
          When: [SHOW_HEADER],
          Then: "「LOCAL」も「DEV」も表示されない",
        },
      ],
    },
    async () => {
      vi.stubEnv("VITE_ENVIRONMENT", undefined);
      mockUsage({ count: 0, limit: 30 });

      renderHeader();

      await screen.findByText("残り 30/30");
      expect(screen.queryByText("LOCAL")).not.toBeInTheDocument();
      expect(screen.queryByText("DEV")).not.toBeInTheDocument();
    },
  );
});

describe("[本体:AI 呼び出し回数]残り回数の表示", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "ログインしていて、今日の AI 呼び出し回数の日次上限が 30 回で、今日の AI 呼び出し回数が 29 回のとき",
          When: [SHOW_HEADER],
          Then: "「残り 1/30」と表示される",
        },
      ],
    },
    async () => {
      mockUsage({ count: 29, limit: 30 });

      renderHeader();

      expect(await screen.findByText("残り 1/30")).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "ログインしていて、今日の AI 呼び出し回数の日次上限が 30 回で、今日の AI 呼び出し回数が 30 回のとき",
          When: [SHOW_HEADER],
          Then: "「残り 0/30」と表示される",
        },
      ],
    },
    async () => {
      mockUsage({ count: 30, limit: 30 });

      renderHeader();

      expect(await screen.findByText("残り 0/30")).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: "ログインしていて、今日の AI 呼び出し回数の日次上限が 30 回で、今日の AI 呼び出し回数が 31 回のとき",
          When: [SHOW_HEADER],
          Then: "「残り 0/30」と表示される",
        },
      ],
    },
    async () => {
      mockUsage({ count: 31, limit: 30 });

      renderHeader();

      expect(await screen.findByText("残り 0/30")).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: "ログインしていて、今日の AI 呼び出し回数の取得に失敗したとき",
          When: [SHOW_HEADER],
          Then: "残り回数が表示されない",
        },
      ],
    },
    async () => {
      // AI 呼び出し回数の取得失敗時の診断ログは検証対象外なので沈黙させる
      vi.spyOn(console, "warn").mockImplementation(() => {});
      server.use(http.get(apiUrl("/usage"), () => HttpResponse.error()));

      renderHeader();

      // 取得の試行が済んでから不在を確かめるため、リクエストが送られるのを待つ
      await waitFor(() => expect(countRequests("/usage")).toBe(1));
      expect(screen.getByText("Pokelingual")).toBeInTheDocument();
      expect(screen.queryByText(/残り/)).not.toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [
        {
          Given:
            "ログインしていて、今日の AI 呼び出し回数の取得に失敗したあと、バックエンドが翻訳の送信に日次上限の 429 を返し、次の取得で AI 呼び出し回数 30 回、日次上限 30 回が返るとき",
          When: ["ヘッダーとクエスト画面を表示する", "翻訳を送信する"],
          Then: "「残り 0/30」と表示される",
        },
      ],
    },
    async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      let usageRequestCount = 0;
      server.use(
        http.get(apiUrl("/usage"), () => {
          usageRequestCount += 1;
          return usageRequestCount === 1
            ? HttpResponse.error()
            : HttpResponse.json({ count: 30, limit: 30 });
        }),
        http.post(apiUrl("/quest/score"), () =>
          HttpResponse.json({ error: "user", message: "上限に たっしました" }, { status: 429 }),
        ),
      );
      renderWithProviders(
        <>
          <Header />
          <QuestPage />
        </>,
        { user: fakeUser, withRouter: true },
      );
      await waitFor(() => expect(countRequests("/usage")).toBe(1));

      await submitTranslationForScoring();

      expect(await screen.findByText("残り 0/30")).toBeInTheDocument();
    },
  );
});

describe("[本体:共通画面]表示の条件", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [{ Given: "ログインしていないとき", When: [SHOW_HEADER], Then: "ヘッダーが表示されない" }],
    },
    () => {
      renderHeader(null);

      expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    },
  );
});

describe("[本体:共通画面]ハンバーガーメニューの開閉", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [{ Given: "ログインしているとき", When: [SHOW_HEADER], Then: "メニューが閉じている" }],
    },
    async () => {
      mockUsage({ count: 0, limit: 30 });
      renderHeader();

      expect(await screen.findByRole("button", { name: "メニュー" })).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [{ Given: "ログインしているとき", When: [SHOW_HEADER, "メニューボタンを押す"], Then: "メニューが開く" }],
    },
    async () => {
      mockUsage({ count: 0, limit: 30 });
      const user = userEvent.setup();
      renderHeader();

      await user.click(await screen.findByRole("button", { name: "メニュー" }));

      expect(screen.getByRole("button", { name: "メニュー" })).toHaveAttribute(
        "aria-expanded",
        "true",
      );
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [{ Given: "ログインしていて、メニューが開いているとき", When: ["「ぼうけん」のリンクを押す"], Then: "メニューが閉じる" }],
    },
    async () => {
      mockUsage({ count: 0, limit: 30 });
      const user = userEvent.setup();
      renderHeader();

      await user.click(await screen.findByRole("button", { name: "メニュー" }));
      await user.click(screen.getByRole("link", { name: "ぼうけん" }));

      expect(screen.getByRole("button", { name: "メニュー" })).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    },
  );
});
