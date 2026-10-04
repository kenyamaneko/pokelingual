import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import App from "./App";

describe("[ルーティング] 404 画面の表示", () => {
  describe("異常系", () => {
    it("未定義の URL を開いたとき、『ページが見つかりません』の見出しが表示される", async () => {
      window.history.pushState({}, "", "/no-such-page");
      render(<App />);

      // 非同期取得が落ち着くまで待たないと act 警告が出るため、findBy で待つ
      expect(
        await screen.findByRole("heading", { name: "ページが見つかりません" }),
      ).toBeInTheDocument();
    });
  });

  describe("正常系", () => {
    it("定義済みの URL (/) を開いたとき、『ページが見つかりません』の見出しは表示されない", async () => {
      window.history.pushState({}, "", "/");
      render(<App />);

      expect(await screen.findByText("Pokelingual")).toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { name: "ページが見つかりません" }),
      ).not.toBeInTheDocument();
    });
  });
});
