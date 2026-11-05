import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect } from "vitest";
import App from "./App";
import { defineCase } from "./test/defineCase";

describe("[本体:共通画面]404 画面の表示", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: "VITE_APP_MODE が mock のとき",
          When: ["存在しない URL「/no-such-page」を開いて、404 画面を表示する"],
          Then: "見出し「ページが見つかりません」が表示される",
        },
      ],
    },
    async () => {
      window.history.pushState({}, "", "/no-such-page");
      render(<App />);

      // 非同期取得が落ち着くまで待たないと act 警告が出るため、findBy で待つ
      expect(
        await screen.findByRole("heading", { name: "ページが見つかりません" }),
      ).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: "VITE_APP_MODE が mock のとき",
          When: ["存在しない URL「/no-such-page」を開いて、404 画面を表示する", "404 画面の「ホーム画面に戻る」を押す"],
          Then: "ホーム画面の「ポケモンを探しに行く」ボタンが表示される",
        },
      ],
    },
    async () => {
      window.history.pushState({}, "", "/no-such-page");
      const user = userEvent.setup();
      render(<App />);

      await user.click(await screen.findByRole("link", { name: "ホーム画面に戻る" }));

      expect(
        await screen.findByRole("button", { name: "ポケモンを探しに行く" }),
      ).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "VITE_APP_MODE が mock のとき",
          When: ["定義済みの URL「/」を開いて、ホーム画面を表示する"],
          Then: "「Pokelingual」が表示され、見出し「ページが見つかりません」は表示されない",
        },
      ],
    },
    async () => {
      window.history.pushState({}, "", "/");
      render(<App />);

      expect(await screen.findByText("Pokelingual")).toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { name: "ページが見つかりません" }),
      ).not.toBeInTheDocument();
    },
  );
});
