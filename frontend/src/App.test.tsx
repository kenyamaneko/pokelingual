import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import App from "./App";

/**
 * ルーティングの 404 仕様:
 * - 未定義 URL では NotFound ページを表示する (catch-all)
 * - 定義済み URL では NotFound を表示しない
 *
 * テスト環境は VITE_APP_MODE=mock のため DevAuthProvider (ログイン済み) で動作する。
 * Header が UsageProvider 経由で /usage を引くため、MSW の既定ハンドラが応答する。
 */
describe("ルーティングの 404", () => {
  it("未定義 URL では『ページが見つかりません』画面を表示する", async () => {
    window.history.pushState({}, "", "/no-such-page");
    render(<App />);

    // findBy で UsageProvider の非同期取得が落ち着くまで待ち、act 警告を避ける
    expect(
      await screen.findByRole("heading", { name: "ページが見つかりません" }),
    ).toBeInTheDocument();
  });

  it("定義済み URL (/) では『ページが見つかりません』画面を表示しない", async () => {
    window.history.pushState({}, "", "/");
    render(<App />);

    // ヘッダー (ログイン後共通) の描画完了を待ってから NotFound の不在を確認する
    expect(await screen.findByText("PokeLingual")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "ページが見つかりません" }),
    ).not.toBeInTheDocument();
  });
});
