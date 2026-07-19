import { describe, it, expect } from "vitest";
import { countRequests } from "../test/mswServer";
import { renderWithProviders } from "../test/render";

describe("[チュートリアル] チュートリアル完了状態の取得 (未ログイン時)", () => {
  it("未ログインのとき、チュートリアル完了状態を取得しない", () => {
    renderWithProviders(<div />, { user: null });

    expect(countRequests("/tutorial-status")).toBe(0);
  });
});
