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

describe("Header", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe("環境ラベルの出し分け", () => {
    it("VITE_ENVIRONMENT=local では LOCAL バッジを表示する", async () => {
      vi.stubEnv("VITE_ENVIRONMENT", "local");
      mockUsage({ count: 0, limit: 30 });

      renderHeader();

      expect(await screen.findByText("LOCAL")).toBeInTheDocument();
    });

    it("VITE_ENVIRONMENT=dev では DEV バッジを表示する", async () => {
      vi.stubEnv("VITE_ENVIRONMENT", "dev");
      mockUsage({ count: 0, limit: 30 });

      renderHeader();

      expect(await screen.findByText("DEV")).toBeInTheDocument();
    });

    it("VITE_ENVIRONMENT=prod では環境バッジを表示しない", async () => {
      vi.stubEnv("VITE_ENVIRONMENT", "prod");
      mockUsage({ count: 0, limit: 30 });

      renderHeader();

      // 残量バッジの出現でレンダー完了を待ってから不在を確かめる
      await screen.findByText("残り 30/30");
      expect(screen.queryByText("LOCAL")).not.toBeInTheDocument();
      expect(screen.queryByText("DEV")).not.toBeInTheDocument();
    });

    it("VITE_ENVIRONMENT が未設定でも環境バッジを表示しない", async () => {
      vi.stubEnv("VITE_ENVIRONMENT", undefined);
      mockUsage({ count: 0, limit: 30 });

      renderHeader();

      await screen.findByText("残り 30/30");
      expect(screen.queryByText("LOCAL")).not.toBeInTheDocument();
      expect(screen.queryByText("DEV")).not.toBeInTheDocument();
    });
  });

  describe("レート残量の表示とクランプ", () => {
    it.each([
      [29, 30, "残り 1/30"],
      [30, 30, "残り 0/30"],
      [31, 30, "残り 0/30"],
    ])(
      "count=%i / limit=%i のとき「%s」と表示する (マイナスにしない)",
      async (count, limit, expected) => {
        mockUsage({ count, limit });

        renderHeader();

        expect(await screen.findByText(expected)).toBeInTheDocument();
      },
    );

    it("usage が取得できないあいだは残量バッジを表示しない", async () => {
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

  it("未ログイン時はヘッダを描画しない", () => {
    renderHeader(null);

    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
  });
});
