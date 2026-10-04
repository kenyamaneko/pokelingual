import { screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { useUsage } from "./UsageContext";
import { server, apiUrl, countRequests } from "../test/mswServer";
import { renderWithProviders } from "../test/render";
import type { User } from "firebase/auth";

/**
 * バックエンドが利用回数と上限を返す状態にする。
 * @param count 当日の利用回数。
 * @param limit 上限。
 */
function mockUsage(count: number, limit: number) {
  server.use(http.get(apiUrl("/usage"), () => HttpResponse.json({ count, limit })));
}

function Probe() {
  const { usage } = useUsage();
  return <div>{usage ? `${usage.count}/${usage.limit}` : "none"}</div>;
}

const fakeUser = { uid: "alice" } as unknown as User;

function renderUsage(user: User | null = fakeUser) {
  return renderWithProviders(<Probe />, { user });
}

describe("[レート制限・利用回数] AI 利用回数の取得", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("正常系", () => {
    it("ログインしているとき、起動すると、バックエンドが返した利用回数と上限が表示される", async () => {
      mockUsage(3, 30);

      renderUsage();

      expect(await screen.findByText("3/30")).toBeInTheDocument();
    });

    it("未ログインのとき、起動しても、利用回数をバックエンドへ問い合わせない", async () => {
      renderUsage(null);
      expect(await screen.findByText("none")).toBeInTheDocument();
      expect(countRequests("/usage")).toBe(0);
    });
  });

  describe("異常系", () => {
    it("ログインしているとき、利用回数の取得に失敗すると、利用回数が表示されない状態のままになる", async () => {
      // 診断ログの出力は検証対象外のため、出力を抑止する
      vi.spyOn(console, "warn").mockImplementation(() => {});
      server.use(http.get(apiUrl("/usage"), () => HttpResponse.error()));

      renderUsage();

      // 失敗の確定を待たないと取得前の状態と区別できず、アサーションが常に通るため、取得の完了を待つ
      await waitFor(() => expect(countRequests("/usage")).toBe(1));
      expect(screen.getByText("none")).toBeInTheDocument();
    });
  });
});
