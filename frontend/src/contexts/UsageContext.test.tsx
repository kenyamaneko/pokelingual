import { screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { useUsage } from "./UsageContext";
import { server, apiUrl, countRequests } from "../test/mswServer";
import { renderWithProviders } from "../test/render";
import type { User } from "firebase/auth";

/**
 * GET /usage が指定の利用状況を返す状態をモックする。
 * @param count 当日の利用回数。
 * @param limit 上限。
 */
function mockUsage(count: number, limit: number) {
  server.use(http.get(apiUrl("/usage"), () => HttpResponse.json({ count, limit })));
}

function Probe() {
  const { usage } = useUsage();
  return <div data-testid="usage">{usage ? `${usage.count}/${usage.limit}` : "none"}</div>;
}

const fakeUser = { uid: "alice" } as unknown as User;

function renderUsage(user: User | null = fakeUser) {
  return renderWithProviders(<Probe />, { user });
}

describe("UsageProvider のふるまい仕様", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("ログイン後にバックエンドの /usage を取得して表示できる", async () => {
    mockUsage(3, 30);

    renderUsage();

    await waitFor(() => {
      expect(screen.getByTestId("usage")).toHaveTextContent("3/30");
    });
  });

  it("usage の取得に失敗しても画面はクラッシュせず、使用量が無い状態のまま動作する", async () => {
    // 使用量は補助情報のため取得失敗を UI では無視する仕様。診断ログは検証対象外なので沈黙させる
    vi.spyOn(console, "warn").mockImplementation(() => {});
    server.use(http.get(apiUrl("/usage"), () => HttpResponse.error()));

    renderUsage();

    // 取得の失敗が確定するまで待ってから、使用量なしの表示のままであることを確かめる
    await waitFor(() => expect(countRequests("/usage")).toBe(1));
    expect(screen.getByTestId("usage")).toHaveTextContent("none");
  });

  it("未ログイン時は usage を取得しない", async () => {
    renderUsage(null);
    await waitFor(() => {
      expect(screen.getByTestId("usage")).toHaveTextContent("none");
    });
    expect(countRequests("/usage")).toBe(0);
  });
});
