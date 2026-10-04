import { describe, it, expect } from "vitest";
import { countRequests } from "../test/mswServer";
import { renderWithProviders } from "../test/render";

describe("[チュートリアル] 完了状態の取得", () => {
  describe("正常系", () => {
    it("未ログインのとき、チュートリアル完了状態をバックエンドへ問い合わせない", () => {
      renderWithProviders(<div />, { user: null });

      expect(countRequests("/tutorial-status")).toBe(0);
    });
  });
});
