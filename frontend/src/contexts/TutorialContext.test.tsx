import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { useTutorial } from "./TutorialContext";
import { server, apiUrl, countRequests } from "../test/mswServer";
import { renderWithProviders } from "../test/render";
import type { User } from "firebase/auth";

/**
 * GET /tutorial-status が指定の完了状態を返す状態をモックする。
 * @param completed チュートリアル完了状態。
 */
function mockTutorialStatus(completed: boolean) {
  server.use(
    http.get(apiUrl("/tutorial-status"), () => HttpResponse.json({ tutorial_completed: completed })),
  );
}

function Probe() {
  const { completed, markCompleted } = useTutorial();
  return (
    <div>
      <div data-testid="completed">{completed === null ? "unknown" : String(completed)}</div>
      <button onClick={markCompleted}>完了にする</button>
    </div>
  );
}

const fakeUser = { uid: "trainer-test" } as unknown as User;

function renderProbe(user: User | null = fakeUser) {
  return renderWithProviders(<Probe />, { user });
}

describe("TutorialProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("ログイン後、保存されているチュートリアル完了状態を取得して表示できる", async () => {
    mockTutorialStatus(true);

    renderProbe();

    await waitFor(() => {
      expect(screen.getByTestId("completed")).toHaveTextContent("true");
    });
  });

  it("チュートリアル完了状態の取得に失敗しても、画面はクラッシュせず未取得表示のまま動作する", async () => {
    // 導線の出し分けは補助的なUXなので取得失敗はUI上無視する仕様。診断ログは検証対象外なので沈黙させる
    vi.spyOn(console, "warn").mockImplementation(() => {});
    server.use(http.get(apiUrl("/tutorial-status"), () => HttpResponse.error()));

    renderProbe();

    await waitFor(() => expect(countRequests("/tutorial-status")).toBe(1));
    expect(screen.getByTestId("completed")).toHaveTextContent("unknown");
  });

  it("未ログイン時は、チュートリアル完了状態を取得しない", async () => {
    renderProbe(null);
    await waitFor(() => {
      expect(screen.getByTestId("completed")).toHaveTextContent("unknown");
    });
    expect(countRequests("/tutorial-status")).toBe(0);
  });

  it("チュートリアルを完了させると、完了状態として表示が切り替わる", async () => {
    mockTutorialStatus(false);
    const user = userEvent.setup();
    renderProbe();
    await waitFor(() => expect(screen.getByTestId("completed")).toHaveTextContent("false"));

    await user.click(screen.getByRole("button", { name: "完了にする" }));

    await waitFor(() => expect(screen.getByTestId("completed")).toHaveTextContent("true"));
  });
});
