import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UsageProvider, useUsage } from "./UsageContext";
import { AuthContext } from "./AuthContext";
import type { User } from "firebase/auth";
import {
  rateLimitEvents,
  RATE_LIMIT_EVENT,
} from "../services/rateLimitEvents";

vi.mock("../services/usageApi", () => {
  return {
    usageApi: {
      get: vi.fn(),
    },
  };
});

const usageApiMock = await import("../services/usageApi");

function Probe() {
  const { usage } = useUsage();
  return <div data-testid="usage">{usage ? `${usage.count}/${usage.limit}` : "none"}</div>;
}

const fakeUser = { uid: "alice" } as unknown as User;

function renderWithAuth(user: User | null = fakeUser) {
  return render(
    <AuthContext.Provider
      value={{
        user,
        loading: false,
        login: async () => {},
        loginWithGoogle: async () => {},
        logout: async () => {},
      }}
    >
      <UsageProvider>
        <Probe />
      </UsageProvider>
    </AuthContext.Provider>,
  );
}

describe("UsageProvider のふるまい仕様", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ログイン後にバックエンドの /usage を取得して表示できる", async () => {
    vi.mocked(usageApiMock.usageApi.get).mockResolvedValue({
      data: { count: 3, limit: 30 },
    } as Awaited<ReturnType<typeof usageApiMock.usageApi.get>>);

    renderWithAuth();

    await waitFor(() => {
      expect(screen.getByTestId("usage")).toHaveTextContent("3/30");
    });
  });

  it("未ログイン時は usage を取得しない", async () => {
    renderWithAuth(null);
    await waitFor(() => {
      expect(screen.getByTestId("usage")).toHaveTextContent("none");
    });
    expect(usageApiMock.usageApi.get).not.toHaveBeenCalled();
  });

  it("レートリミットイベントを受信するとモーダル（タイトル）が表示される", async () => {
    vi.mocked(usageApiMock.usageApi.get).mockResolvedValue({
      data: { count: 30, limit: 30 },
    } as Awaited<ReturnType<typeof usageApiMock.usageApi.get>>);

    renderWithAuth();
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
    vi.mocked(usageApiMock.usageApi.get).mockResolvedValue({
      data: { count: 0, limit: 30 },
    } as Awaited<ReturnType<typeof usageApiMock.usageApi.get>>);

    renderWithAuth();
    await waitFor(() => expect(usageApiMock.usageApi.get).toHaveBeenCalledTimes(1));

    vi.mocked(usageApiMock.usageApi.get).mockResolvedValue({
      data: { count: 30, limit: 30 },
    } as Awaited<ReturnType<typeof usageApiMock.usageApi.get>>);

    act(() => {
      rateLimitEvents.dispatchEvent(
        new CustomEvent(RATE_LIMIT_EVENT, {
          detail: { kind: "user", message: "x" },
        }),
      );
    });

    await waitFor(() => expect(usageApiMock.usageApi.get).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId("usage")).toHaveTextContent("30/30"));
  });
});
