import { screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import type { User } from "firebase/auth";
import type { DailyUsage } from "../../../../shared/api-types/usage";
import { server, apiUrl, countRequests } from "../../test/mswServer";
import { renderWithProviders } from "../../test/render";
import { Header } from "./Header";

/**
 * Header の仕様:
 * - 環境ラベル: local では LOCAL、dev では DEV を表示し、prod・未設定・想定外の値では出さない
 * - レート残量: 「残り (limit - count)/limit」を表示し、超過時はマイナスにせず 0 にクランプする
 * - usage が取得できないあいだは残量バッジを出さない
 * - 未ログイン時はヘッダ自体を描画しない
 */
const fakeUser = { uid: "alice" } as unknown as User;

function mockUsage(usage: DailyUsage) {
  server.use(http.get(apiUrl("/usage"), () => HttpResponse.json(usage)));
}

function renderHeader(user: User | null = fakeUser) {
  return renderWithProviders(<Header />, { user, withRouter: true });
}

describe("ヘッダー", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe("環境ラベルの出し分け", () => {
    it("local 環境では LOCAL バッジを表示する", async () => {
      vi.stubEnv("VITE_ENVIRONMENT", "local");
      mockUsage({ count: 0, limit: 30 });

      renderHeader();

      expect(await screen.findByText("LOCAL")).toBeInTheDocument();
    });

    it("dev 環境では DEV バッジを表示する", async () => {
      vi.stubEnv("VITE_ENVIRONMENT", "dev");
      mockUsage({ count: 0, limit: 30 });

      renderHeader();

      expect(await screen.findByText("DEV")).toBeInTheDocument();
    });

    it("prod 環境では環境バッジを表示しない", async () => {
      vi.stubEnv("VITE_ENVIRONMENT", "prod");
      mockUsage({ count: 0, limit: 30 });

      renderHeader();

      // 残量バッジの出現でレンダー完了を待ってから不在を確かめる
      await screen.findByText("残り 30/30");
      expect(screen.queryByText("LOCAL")).not.toBeInTheDocument();
      expect(screen.queryByText("DEV")).not.toBeInTheDocument();
    });

    it("実行環境が未設定でも環境バッジを表示しない", async () => {
      vi.stubEnv("VITE_ENVIRONMENT", undefined);
      mockUsage({ count: 0, limit: 30 });

      renderHeader();

      await screen.findByText("残り 30/30");
      expect(screen.queryByText("LOCAL")).not.toBeInTheDocument();
      expect(screen.queryByText("DEV")).not.toBeInTheDocument();
    });
  });

  describe("レート残量の表示 (マイナスにしない)", () => {
    it.each([
      [29, 30, "残り 1/30"],
      [30, 30, "残り 0/30"],
      [31, 30, "残り 0/30"],
    ])(
      "利用済み %i 回・上限 %i 回のとき「%s」と表示する",
      async (count, limit, expected) => {
        mockUsage({ count, limit });

        renderHeader();

        expect(await screen.findByText(expected)).toBeInTheDocument();
      },
    );

    it("利用状況が取得できないあいだは残量バッジを表示しない", async () => {
      // 使用量取得失敗時の診断ログは検証対象外なので沈黙させる
      vi.spyOn(console, "warn").mockImplementation(() => {});
      server.use(http.get(apiUrl("/usage"), () => HttpResponse.error()));

      renderHeader();

      // /usage の取得が試みられたことを確かめてから、残量バッジの不在を確認する
      await waitFor(() => expect(countRequests("/usage")).toBe(1));
      expect(screen.getByText("PokeLingual")).toBeInTheDocument();
      expect(screen.queryByText(/残り/)).not.toBeInTheDocument();
    });
  });

  it("未ログイン時はヘッダーを描画しない", () => {
    renderHeader(null);

    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
  });
});
