import { screen, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AxiosResponse } from "axios";
import { useUsage } from "./UsageContext";
import { usageApi } from "../api/usageApi";
import type { DailyUsage } from "../../../shared/api-types/usage";
import {
  rateLimitEvents,
  RATE_LIMIT_EVENT,
} from "../utils/rateLimitEvents";
import { renderWithProviders } from "../test/render";
import type { User } from "firebase/auth";

vi.mock("../api/usageApi", () => ({
  usageApi: { get: vi.fn() },
}));

function mockUsage(count: number, limit: number) {
  vi.mocked(usageApi.get).mockResolvedValue({
    data: { count, limit },
  } as AxiosResponse<DailyUsage>);
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ログイン後にバックエンドの /usage を取得して表示できる", async () => {
    mockUsage(3, 30);

    renderUsage();

    await waitFor(() => {
      expect(screen.getByTestId("usage")).toHaveTextContent("3/30");
    });
  });

  it("未ログイン時は usage を取得しない", async () => {
    renderUsage(null);
    await waitFor(() => {
      expect(screen.getByTestId("usage")).toHaveTextContent("none");
    });
    expect(usageApi.get).not.toHaveBeenCalled();
  });

  it("レートリミットイベントを受信するとモーダル（タイトル）が表示される", async () => {
    mockUsage(30, 30);

    renderUsage();
    await waitFor(() => expect(screen.getByTestId("usage")).toHaveTextContent("30/30"));

    act(() => {
      rateLimitEvents.dispatchEvent(
        new CustomEvent(RATE_LIMIT_EVENT, {
          detail: { kind: "user", message: "上限に たっしました" },
        }),
      );
    });

    expect(await screen.findByText(/しゅぎょう/)).toBeInTheDocument();
  });

  it("レートリミット発火後は最新の usage を再取得する", async () => {
    mockUsage(0, 30);

    renderUsage();
    await waitFor(() => expect(usageApi.get).toHaveBeenCalledTimes(1));

    mockUsage(30, 30);

    act(() => {
      rateLimitEvents.dispatchEvent(
        new CustomEvent(RATE_LIMIT_EVENT, {
          detail: { kind: "user", message: "x" },
        }),
      );
    });

    await waitFor(() => expect(usageApi.get).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId("usage")).toHaveTextContent("30/30"));
  });
});
