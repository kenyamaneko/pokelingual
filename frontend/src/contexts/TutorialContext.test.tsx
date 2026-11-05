import { describe, it, expect } from "vitest";
import { countRequests } from "../test/mswServer";
import { renderWithProviders } from "../test/render";

describe("[本体:チュートリアル]完了状態の取得", () => {
  describe("部品間結合テスト", () => {
    describe("正常系", () => {
      it("未ログインのとき、アプリを起動しても、バックエンドの「/tutorial-status」へのリクエストは 0 件のままになる", () => {
        renderWithProviders(<div />, { user: null });

        expect(countRequests("/tutorial-status")).toBe(0);
      });
    });
  });
});
