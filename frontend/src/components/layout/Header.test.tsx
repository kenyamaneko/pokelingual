import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import type { User } from "firebase/auth";
import type { DailyUsage } from "../../../../shared/api-types/usage";
import { server, apiUrl, countRequests } from "../../test/mswServer";
import { renderWithProviders } from "../../test/render";
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

describe("[ヘッダー] 実行環境の表示", () => {
  describe("正常系", () => {
    it("実行環境が local のとき、「LOCAL」と表示される", async () => {
      vi.stubEnv("VITE_ENVIRONMENT", "local");
      mockUsage({ count: 0, limit: 30 });

      renderHeader();

      expect(await screen.findByText("LOCAL")).toBeInTheDocument();
    });

    it("実行環境が dev のとき、「DEV」と表示される", async () => {
      vi.stubEnv("VITE_ENVIRONMENT", "dev");
      mockUsage({ count: 0, limit: 30 });

      renderHeader();

      expect(await screen.findByText("DEV")).toBeInTheDocument();
    });

    it("実行環境が prod のとき、「LOCAL」も「DEV」も表示されない", async () => {
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
    it("実行環境が未設定のとき、「LOCAL」も「DEV」も表示されない", async () => {
      vi.stubEnv("VITE_ENVIRONMENT", undefined);
      mockUsage({ count: 0, limit: 30 });

      renderHeader();

      await screen.findByText("残り 30/30");
      expect(screen.queryByText("LOCAL")).not.toBeInTheDocument();
      expect(screen.queryByText("DEV")).not.toBeInTheDocument();
    });
  });
});

describe("[ヘッダー] 今日の残り回数の表示", () => {
  describe("正常系", () => {
    describe("今日の利用回数の上限が 30 回のとき", () => {
      it.each([
        [29, "残り 1/30"],
        [30, "残り 0/30"],
      ])("今日の利用済み回数が %i 回のとき、「%s」と表示される", async (count, expected) => {
        mockUsage({ count, limit: 30 });

        renderHeader();

        expect(await screen.findByText(expected)).toBeInTheDocument();
      });
    });
  });

  describe("異常系", () => {
    it("今日の利用回数の上限が 30 回で利用済み回数が 31 回のとき、「残り 0/30」と表示される", async () => {
      mockUsage({ count: 31, limit: 30 });

      renderHeader();

      expect(await screen.findByText("残り 0/30")).toBeInTheDocument();
    });

    it("今日の利用状況の取得に失敗したとき、残り回数が表示されない", async () => {
      // 利用状況の取得失敗時の診断ログは検証対象外なので沈黙させる
      vi.spyOn(console, "warn").mockImplementation(() => {});
      server.use(http.get(apiUrl("/usage"), () => HttpResponse.error()));

      renderHeader();

      // 取得の試行が済んでから不在を確かめるため、リクエストが送られるのを待つ
      await waitFor(() => expect(countRequests("/usage")).toBe(1));
      expect(screen.getByText("Pokelingual")).toBeInTheDocument();
      expect(screen.queryByText(/残り/)).not.toBeInTheDocument();
    });
  });
});

describe("[ヘッダー] 表示の条件", () => {
  describe("異常系", () => {
    it("ログインしていないとき、ヘッダーが表示されない", () => {
      renderHeader(null);

      expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    });
  });
});

describe("[ヘッダー] ハンバーガーメニューの開閉", () => {
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
