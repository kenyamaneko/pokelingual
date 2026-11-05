import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import type { User } from "firebase/auth";
import type { DailyUsage } from "../../../../shared/api-types/usage";
import { QuestPage } from "../../pages/QuestPage";
import { server, apiUrl, countRequests } from "../../test/mswServer";
import { renderWithProviders } from "../../test/render";
import { submitTranslationForScoring } from "../../test/scoringFlow";
import { Header } from "./Header";

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

describe("[本体:ヘッダー]実行環境の表示", () => {
  describe("ログインしているとき", () => {
    describe("部品間結合テスト", () => {
      describe("正常系", () => {
        it("VITE_ENVIRONMENT が local のとき、「LOCAL」と表示される", async () => {
          vi.stubEnv("VITE_ENVIRONMENT", "local");
          mockUsage({ count: 0, limit: 30 });

          renderHeader();

          expect(await screen.findByText("LOCAL")).toBeInTheDocument();
        });

        it("VITE_ENVIRONMENT が dev のとき、「DEV」と表示される", async () => {
          vi.stubEnv("VITE_ENVIRONMENT", "dev");
          mockUsage({ count: 0, limit: 30 });

          renderHeader();

          expect(await screen.findByText("DEV")).toBeInTheDocument();
        });

        it("VITE_ENVIRONMENT が prod のとき、「LOCAL」も「DEV」も表示されない", async () => {
          vi.stubEnv("VITE_ENVIRONMENT", "prod");
          mockUsage({ count: 0, limit: 30 });

          renderHeader();

          // 描画の完了を待ってから不在を確かめるため、残り回数の表示が出るのを待つ
          await screen.findByText("残り 30/30");
          expect(screen.queryByText("LOCAL")).not.toBeInTheDocument();
          expect(screen.queryByText("DEV")).not.toBeInTheDocument();
        });
      });

      describe("異常系", () => {
        it("VITE_ENVIRONMENT が未設定のとき、「LOCAL」も「DEV」も表示されない", async () => {
          vi.stubEnv("VITE_ENVIRONMENT", undefined);
          mockUsage({ count: 0, limit: 30 });

          renderHeader();

          await screen.findByText("残り 30/30");
          expect(screen.queryByText("LOCAL")).not.toBeInTheDocument();
          expect(screen.queryByText("DEV")).not.toBeInTheDocument();
        });
      });
    });
  });
});

describe("[本体:ヘッダー]今日の残り回数の表示", () => {
  describe("ログインしているとき", () => {
    describe("今日の AI 呼び出し回数の日次上限が 30 回のとき", () => {
      describe("部品間結合テスト", () => {
        describe("正常系", () => {
          it("今日の AI 呼び出し回数が 29 回のとき、「残り 1/30」と表示される", async () => {
            mockUsage({ count: 29, limit: 30 });

            renderHeader();

            expect(await screen.findByText("残り 1/30")).toBeInTheDocument();
          });

          it("今日の AI 呼び出し回数が 30 回のとき、「残り 0/30」と表示される", async () => {
            mockUsage({ count: 30, limit: 30 });

            renderHeader();

            expect(await screen.findByText("残り 0/30")).toBeInTheDocument();
          });
        });

        describe("異常系", () => {
          it("今日の AI 呼び出し回数が 31 回のとき、「残り 0/30」と表示される", async () => {
            mockUsage({ count: 31, limit: 30 });

            renderHeader();

            expect(await screen.findByText("残り 0/30")).toBeInTheDocument();
          });
        });
      });
    });

    describe("部品間結合テスト", () => {
      describe("異常系", () => {
        it("今日の AI 呼び出し回数の取得に失敗したとき、残り回数が表示されない", async () => {
          // AI 呼び出し回数の取得失敗時の診断ログは検証対象外なので沈黙させる
          vi.spyOn(console, "warn").mockImplementation(() => {});
          server.use(http.get(apiUrl("/usage"), () => HttpResponse.error()));

          renderHeader();

          // 取得の試行が済んでから不在を確かめるため、リクエストが送られるのを待つ
          await waitFor(() => expect(countRequests("/usage")).toBe(1));
          expect(screen.getByText("Pokelingual")).toBeInTheDocument();
          expect(screen.queryByText(/残り/)).not.toBeInTheDocument();
        });

        it("今日の AI 呼び出し回数の取得に失敗したあと、翻訳を送信してバックエンドが日次上限の 429 を返し、次の取得で AI 呼び出し回数 30 回、日次上限 30 回が返るとき、「残り 0/30」と表示される", async () => {
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
        });
      });
    });
  });
});

describe("[本体:ヘッダー]表示の条件", () => {
  describe("部品間結合テスト", () => {
    describe("異常系", () => {
      it("ログインしていないとき、ヘッダーが表示されない", () => {
        renderHeader(null);

        expect(screen.queryByRole("banner")).not.toBeInTheDocument();
      });
    });
  });
});

describe("[本体:ヘッダー]ハンバーガーメニューの開閉", () => {
  describe("ログインしているとき", () => {
    describe("部品間結合テスト", () => {
      describe("正常系", () => {
        it("ヘッダーを表示した直後は、メニューが閉じている", async () => {
          mockUsage({ count: 0, limit: 30 });
          renderHeader();

          expect(await screen.findByRole("button", { name: "メニュー" })).toHaveAttribute(
            "aria-expanded",
            "false",
          );
        });

        it("メニューボタンを押すと、メニューが開く", async () => {
          mockUsage({ count: 0, limit: 30 });
          const user = userEvent.setup();
          renderHeader();

          await user.click(await screen.findByRole("button", { name: "メニュー" }));

          expect(screen.getByRole("button", { name: "メニュー" })).toHaveAttribute(
            "aria-expanded",
            "true",
          );
        });

        it("メニューが開いているとき、「ぼうけん」のリンクを押すと、メニューが閉じる", async () => {
          mockUsage({ count: 0, limit: 30 });
          const user = userEvent.setup();
          renderHeader();

          await user.click(await screen.findByRole("button", { name: "メニュー" }));
          await user.click(screen.getByRole("link", { name: "ぼうけん" }));

          expect(screen.getByRole("button", { name: "メニュー" })).toHaveAttribute(
            "aria-expanded",
            "false",
          );
        });
      });
    });
  });
});
