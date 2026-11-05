import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import App from "./App";

describe("[本体:画面遷移]404 画面の表示", () => {
  describe("VITE_APP_MODE が mock のとき", () => {
    describe("URL が「/no-such-page」の画面を開いたとき", () => {
      describe("部品間結合テスト", () => {
        describe("異常系", () => {
          it("見出し「ページが見つかりません」が表示される", async () => {
            window.history.pushState({}, "", "/no-such-page");
            render(<App />);

            // 非同期取得が落ち着くまで待たないと act 警告が出るため、findBy で待つ
            expect(
              await screen.findByRole("heading", { name: "ページが見つかりません" }),
            ).toBeInTheDocument();
          });

          it("「ホーム画面に戻る」を押すと、ホーム画面の「ポケモンを探しに行く」ボタンが表示される", async () => {
            window.history.pushState({}, "", "/no-such-page");
            const user = userEvent.setup();
            render(<App />);

            await user.click(await screen.findByRole("link", { name: "ホーム画面に戻る" }));

            expect(
              await screen.findByRole("button", { name: "ポケモンを探しに行く" }),
            ).toBeInTheDocument();
          });
        });
      });
    });

    describe("定義済みの URL「/」を開いたとき", () => {
      describe("部品間結合テスト", () => {
        describe("正常系", () => {
          it("見出し「ページが見つかりません」は表示されない", async () => {
            window.history.pushState({}, "", "/");
            render(<App />);

            expect(await screen.findByText("Pokelingual")).toBeInTheDocument();
            expect(
              screen.queryByRole("heading", { name: "ページが見つかりません" }),
            ).not.toBeInTheDocument();
          });
        });
      });
    });
  });
});
