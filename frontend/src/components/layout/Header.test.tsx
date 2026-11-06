import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, vi, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes } from "react-router";
import type { User } from "firebase/auth";
import type { DailyUsage } from "../../../../shared/api-types/usage";
import { HomePage } from "../../pages/HomePage";
import { LoginPage } from "../../pages/LoginPage";
import { QuestPage } from "../../pages/QuestPage";
import { server, apiUrl, countRequests } from "../../test/mswServer";
import { renderWithProviders } from "../../test/render";
import { submitTranslationForScoring } from "../../test/scoringFlow";
import { Header } from "./Header";
import { defineCase, type Viewpoint } from "../../test/defineCase";

const fakeUser = { uid: "alice" } as unknown as User;

function mockUsage(usage: DailyUsage) {
  server.use(http.get(apiUrl("/usage"), () => HttpResponse.json(usage)));
}

function renderLoginScreen() {
  return renderWithProviders(
    <MemoryRouter initialEntries={["/login"]}>
      <Header />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
      </Routes>
    </MemoryRouter>,
    { user: null },
  );
}

function renderHomeScreen() {
  return renderWithProviders(
    <MemoryRouter initialEntries={["/"]}>
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/quest" element={<QuestPage />} />
      </Routes>
    </MemoryRouter>,
    { user: fakeUser },
  );
}

function findHeader() {
  return screen.findByRole("banner");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const OPEN_HOME_SCREEN = "ホーム画面を開く";
const OPEN_LOGIN_SCREEN = "ログイン画面を開く";
const OPEN_QUEST_SCREEN = "クエスト画面を開く";
const PRESS_HAMBURGER_MENU_BUTTON = "ホーム画面のヘッダーで、「メニュー」ボタンを押す";
const PRESS_HAMBURGER_MENU_QUEST_LINK = "ホーム画面のヘッダーのハンバーガーメニューで、「ぼうけん」リンクを押す";
const SUBMIT_TRANSLATION_FOR_SCORING = [
  "場所選択画面で「木漏れ日の森」を選ぶ",
  "クエスト画面の翻訳の入力欄に「このポケモンが何匹か集まると、強い電気がたまって雷が落ちることがある」と入力する",
  "クエスト画面の翻訳の入力欄で、「この翻訳に決めた！」ボタンを押す",
] as const;

describe("[共通:画面共通]実行環境の表示", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      観点: ["同値分割"],
      steps: [{ Given: "ログインしていて、VITE_ENVIRONMENT が local のとき", When: [OPEN_HOME_SCREEN], Then: "ヘッダーに「LOCAL」と表示される" }],
    },
    async () => {
      vi.stubEnv("VITE_ENVIRONMENT", "local");
      mockUsage({ count: 0, limit: 30 });

      renderHomeScreen();

      expect(await within(await findHeader()).findByText("LOCAL")).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      観点: ["同値分割"],
      steps: [{ Given: "ログインしていて、VITE_ENVIRONMENT が dev のとき", When: [OPEN_HOME_SCREEN], Then: "ヘッダーに「DEV」と表示される" }],
    },
    async () => {
      vi.stubEnv("VITE_ENVIRONMENT", "dev");
      mockUsage({ count: 0, limit: 30 });

      renderHomeScreen();

      expect(await within(await findHeader()).findByText("DEV")).toBeInTheDocument();
    },
  );

  const environmentBadgeHiddenScenarios: {
    given: string;
    outcome: "正常系" | "異常系";
    environment: string | undefined;
    viewpoints: readonly Viewpoint[];
  }[] = [
    { given: "ログインしていて、VITE_ENVIRONMENT が prod のとき", outcome: "正常系", environment: "prod", viewpoints: ["同値分割"] },
    { given: "ログインしていて、VITE_ENVIRONMENT が未設定のとき", outcome: "異常系", environment: undefined, viewpoints: ["エッジケース"] },
  ];
  for (const { given, outcome, environment, viewpoints } of environmentBadgeHiddenScenarios) {
    defineCase(
      {
        種別: "部品間結合テスト",
        正常異常: outcome,
        観点: viewpoints,
        steps: [{ Given: given, When: [OPEN_HOME_SCREEN], Then: "ヘッダーに「LOCAL」も「DEV」も表示されない" }],
      },
      async () => {
        vi.stubEnv("VITE_ENVIRONMENT", environment);
        mockUsage({ count: 0, limit: 30 });

        renderHomeScreen();

        // 描画の完了を待ってから不在を確かめるため、残り回数の表示が出るのを待つ
        const header = within(await findHeader());
        await header.findByText("残り 30/30");
        expect(header.queryByText("LOCAL")).not.toBeInTheDocument();
        expect(header.queryByText("DEV")).not.toBeInTheDocument();
      },
    );
  }
});

describe("[本体:AI 呼び出し回数]残り回数の表示", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      観点: ["境界値"],
      steps: [
        {
          Given: "ログインしていて、今日の AI 呼び出し回数が 29 回で、日次上限が 30 回のとき",
          When: [OPEN_HOME_SCREEN],
          Then: "ヘッダーに「残り 1/30」と表示される",
        },
      ],
    },
    async () => {
      mockUsage({ count: 29, limit: 30 });

      renderHomeScreen();

      expect(await within(await findHeader()).findByText("残り 1/30")).toBeInTheDocument();
    },
  );

  const usageExhaustedScenarios: {
    given: string;
    outcome: "正常系" | "異常系";
    count: number;
    viewpoints: readonly Viewpoint[];
  }[] = [
    { given: "ログインしていて、今日の AI 呼び出し回数が 30 回で、日次上限が 30 回のとき", outcome: "正常系", count: 30, viewpoints: ["境界値"] },
    { given: "ログインしていて、今日の AI 呼び出し回数が 31 回で、日次上限が 30 回のとき", outcome: "異常系", count: 31, viewpoints: ["境界値", "エッジケース"] },
  ];
  for (const { given, outcome, count, viewpoints } of usageExhaustedScenarios) {
    defineCase(
      {
        種別: "部品間結合テスト",
        正常異常: outcome,
        観点: viewpoints,
        steps: [{ Given: given, When: [OPEN_HOME_SCREEN], Then: "ヘッダーに「残り 0/30」と表示される" }],
      },
      async () => {
        mockUsage({ count, limit: 30 });

        renderHomeScreen();

        expect(await within(await findHeader()).findByText("残り 0/30")).toBeInTheDocument();
      },
    );
  }

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      観点: ["外部依存の失敗"],
      steps: [
        {
          Given: "ログインしていて、今日の AI 呼び出し回数を取得できないとき",
          When: [OPEN_HOME_SCREEN],
          Then: "ヘッダーに残り回数が表示されない",
        },
      ],
    },
    async () => {
      // AI 呼び出し回数の取得失敗時の診断ログは検証対象外なので沈黙させる
      vi.spyOn(console, "warn").mockImplementation(() => {});
      server.use(http.get(apiUrl("/usage"), () => HttpResponse.error()));

      renderHomeScreen();

      // 取得の試行が済んでから不在を確かめるため、リクエストが送られるのを待つ
      await waitFor(() => expect(countRequests("/usage")).toBe(1));
      const header = within(await findHeader());
      expect(header.getByText("Pokelingual")).toBeInTheDocument();
      expect(header.queryByText(/残り/)).not.toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      観点: ["外部依存の失敗", "回復確認"],
      steps: [
        {
          Given: "ログインしていて、最初は今日の AI 呼び出し回数を取得できず、その後は今日の AI 呼び出し回数が 30 回で、日次上限が 30 回のとき",
          When: [OPEN_QUEST_SCREEN, ...SUBMIT_TRANSLATION_FOR_SCORING],
          Then: "ヘッダーに「残り 0/30」と表示される",
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

      expect(await within(await findHeader()).findByText("残り 0/30")).toBeInTheDocument();
    },
  );
});

describe("[共通:画面共通]ヘッダーの表示条件", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [{ Given: "ログインしていないとき", When: [OPEN_LOGIN_SCREEN], Then: "ヘッダーが表示されない" }],
    },
    () => {
      renderLoginScreen();

      expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    },
  );
});

describe("[共通:画面共通]ハンバーガーメニューの開閉", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [{ Given: "ログインしているとき", When: [OPEN_HOME_SCREEN], Then: "ハンバーガーメニューが閉じている" }],
    },
    async () => {
      mockUsage({ count: 0, limit: 30 });
      renderHomeScreen();

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
      steps: [{ Given: "ログインしているとき", When: [OPEN_HOME_SCREEN, PRESS_HAMBURGER_MENU_BUTTON], Then: "ハンバーガーメニューが開く" }],
    },
    async () => {
      mockUsage({ count: 0, limit: 30 });
      const user = userEvent.setup();
      renderHomeScreen();

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
      steps: [{ Given: "ログインしているとき", When: [OPEN_HOME_SCREEN, PRESS_HAMBURGER_MENU_BUTTON, PRESS_HAMBURGER_MENU_QUEST_LINK], Then: "ハンバーガーメニューが閉じる" }],
    },
    async () => {
      mockUsage({ count: 0, limit: 30 });
      const user = userEvent.setup();
      renderHomeScreen();

      await user.click(await screen.findByRole("button", { name: "メニュー" }));
      await user.click(screen.getByRole("link", { name: "ぼうけん" }));

      expect(screen.getByRole("button", { name: "メニュー" })).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    },
  );
});
