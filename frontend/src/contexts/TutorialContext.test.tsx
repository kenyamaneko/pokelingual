import { describe, expect } from "vitest";
import { countRequests } from "../test/mswServer";
import { renderWithProviders } from "../test/render";
import { defineCase } from "../test/defineCase";

describe("[本体:チュートリアル]チュートリアル完了状態の取得と記録", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "未ログインのとき",
          When: ["アプリを起動して、チュートリアル完了状態の取得を開始する"],
          Then: "バックエンドの「/tutorial-status」へのリクエストは 0 件のままになる",
        },
      ],
    },
    () => {
      renderWithProviders(<div />, { user: null });

      expect(countRequests("/tutorial-status")).toBe(0);
    },
  );
});
