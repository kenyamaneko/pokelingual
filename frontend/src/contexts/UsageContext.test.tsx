import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import api from "../api/client";
import { useUsage } from "./UsageContext";
import { server, apiUrl, countRequests } from "../test/mswServer";
import { renderWithProviders } from "../test/render";
import type { User } from "firebase/auth";

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

describe("[本体:AI 呼び出し回数]AI 呼び出し回数の取得", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("部品間結合テスト", () => {
    describe("正常系", () => {
      it("ログインしていて、バックエンドが AI 呼び出し回数 3、日次上限 30 を返すとき、起動すると、AI 呼び出し回数の表示が「3/30」になる", async () => {
        mockUsage(3, 30);

        renderUsage();

        expect(await screen.findByText("3/30")).toBeInTheDocument();
      });
    });
  });

  describe("未ログインのとき", () => {
    describe("起動すると", () => {
      describe("部品間結合テスト", () => {
        describe("正常系", () => {
          it("AI 呼び出し回数の表示が「未取得」のままになる", async () => {
            renderUsage(null);

            expect(await screen.findByText("未取得")).toBeInTheDocument();
          });

          it("バックエンドの「/usage」へのリクエストは 0 件のままになる", async () => {
            renderUsage(null);
            await screen.findByText("未取得");

            expect(countRequests("/usage")).toBe(0);
          });
        });
      });
    });
  });

  describe("ログインしていて、バックエンドの AI 呼び出し回数の取得が通信エラーで失敗したとき", () => {
    describe("部品間結合テスト", () => {
      describe("異常系", () => {
        it("起動すると、AI 呼び出し回数の表示が「未取得」のままになる", async () => {
          const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
          server.use(http.get(apiUrl("/usage"), () => HttpResponse.error()));

          renderUsage();

          await waitFor(() => expect(warnSpy).toHaveBeenCalled());
          expect(screen.getByText("未取得")).toBeInTheDocument();
        });

        it("バックエンドが日次上限に達する操作に 429 を返し、その後の取得で AI 呼び出し回数 30、日次上限 30 を返すとき、日次上限に達する操作をすると、AI 呼び出し回数の表示が「30/30」になる", async () => {
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
        });
      });
    });
  });
});
