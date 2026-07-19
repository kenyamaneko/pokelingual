import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
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
  const { ensureStatus, markCompleted } = useTutorial();
  const [status, setStatus] = useState("未確認");

  const check = async () => {
    try {
      const done = await ensureStatus();
      setStatus(done ? "完了済み" : "未完了");
    } catch {
      setStatus("取得エラー");
    }
  };

  return (
    <div>
      <p>{status}</p>
      <button onClick={check}>確認する</button>
      <button onClick={markCompleted}>完了にする</button>
    </div>
  );
}

const fakeUser = { uid: "trainer-test" } as unknown as User;

function renderProbe(user: User | null = fakeUser) {
  return renderWithProviders(<Probe />, { user });
}

describe("[チュートリアル] チュートリアル完了状態の管理", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("チュートリアル完了済みのとき、確認すると完了済みになる", async () => {
    mockTutorialStatus(true);
    const user = userEvent.setup();
    renderProbe();

    await user.click(screen.getByRole("button", { name: "確認する" }));

    expect(await screen.findByText("完了済み")).toBeInTheDocument();
  });

  it("チュートリアル完了状態の取得に失敗したとき、確認すると取得エラーになる", async () => {
    // 診断ログは検証対象外なので沈黙させる
    vi.spyOn(console, "warn").mockImplementation(() => {});
    server.use(http.get(apiUrl("/tutorial-status"), () => HttpResponse.error()));
    const user = userEvent.setup();
    renderProbe();

    await user.click(screen.getByRole("button", { name: "確認する" }));

    expect(await screen.findByText("取得エラー")).toBeInTheDocument();
  });

  it("未ログインのとき、チュートリアル完了状態を取得しない", async () => {
    renderProbe(null);

    await waitFor(() => expect(screen.getByText("未確認")).toBeInTheDocument());
    expect(countRequests("/tutorial-status")).toBe(0);
  });

  it("チュートリアル未完了の状態から完了させると、以後の確認で完了済みになる", async () => {
    mockTutorialStatus(false);
    const user = userEvent.setup();
    renderProbe();
    await user.click(screen.getByRole("button", { name: "確認する" }));
    await screen.findByText("未完了");

    await user.click(screen.getByRole("button", { name: "完了にする" }));
    await user.click(screen.getByRole("button", { name: "確認する" }));

    expect(await screen.findByText("完了済み")).toBeInTheDocument();
  });
});
