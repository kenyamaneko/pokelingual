import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { RateLimitModal } from "./RateLimitModal";

// ユーザー上限・全体上限到達時に出るモーダルのふるまい仕様
describe("RateLimitModal の表示仕様", () => {
  it("ユーザー上限到達時はユーザー向けタイトルを出す", () => {
    render(
      <RateLimitModal
        detail={{ kind: "user", message: "テストメッセージ" }}
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByText(/しゅぎょう/)).toBeInTheDocument();
  });

  it("全体上限到達時はトレーナー混雑のタイトルを出す", () => {
    render(
      <RateLimitModal
        detail={{ kind: "global", message: "テストメッセージ" }}
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByText(/トレーナー/)).toBeInTheDocument();
  });

  it("API から受け取ったメッセージが表示される", () => {
    render(
      <RateLimitModal
        detail={{ kind: "user", message: "サーバーからの メッセージ" }}
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByText(/サーバーからの/)).toBeInTheDocument();
  });

  it("リセット時刻までのカウントダウンが表示される", () => {
    render(
      <RateLimitModal
        detail={{ kind: "user", message: "x" }}
        onDismiss={() => {}}
      />,
    );
    // hh:mm:ss 形式
    expect(screen.getByText(/^\d{2}:\d{2}:\d{2}$/)).toBeInTheDocument();
  });

  it("「また あした くる」ボタン押下で onDismiss が呼ばれる", async () => {
    const onDismiss = vi.fn();
    render(
      <RateLimitModal
        detail={{ kind: "user", message: "x" }}
        onDismiss={onDismiss}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /また/ }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("背景クリックでも閉じられる", async () => {
    const onDismiss = vi.fn();
    const { container } = render(
      <RateLimitModal
        detail={{ kind: "user", message: "x" }}
        onDismiss={onDismiss}
      />,
    );
    // 背景オーバーレイ要素
    await userEvent.click(container.firstChild as Element);
    expect(onDismiss).toHaveBeenCalled();
  });
});
