import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { spec } from "../../test/labels";
import { RateLimitModal, RATE_LIMIT_LABELS } from "./RateLimitModal";

/**
 * RateLimitModal の仕様:
 * - kind ("user" / "global") に応じてタイトルが切り替わる
 * - 閉じるボタン (×) と「また あした くる」ボタンで onDismiss が呼ばれる
 * - 背景 (バックドロップ) クリックで onDismiss が呼ばれる
 *
 * カウントダウン表示は実装詳細 (フォーマットは変わりうる) のためテストしない。
 */
describe("RateLimitModal の仕様", () => {
  it("kind=user のときユーザ向けタイトルを出す", () => {
    render(
      <RateLimitModal
        detail={{ kind: "user", message: "x" }}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText(spec(RATE_LIMIT_LABELS.userTitle))).toBeInTheDocument();
  });

  it("kind=global のときグローバル向けタイトルを出す", () => {
    render(
      <RateLimitModal
        detail={{ kind: "global", message: "x" }}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText(spec(RATE_LIMIT_LABELS.globalTitle))).toBeInTheDocument();
  });

  it("閉じる (×) ボタンで onDismiss が呼ばれる", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <RateLimitModal detail={{ kind: "user", message: "x" }} onDismiss={onDismiss} />,
    );

    await user.click(
      screen.getByRole("button", { name: RATE_LIMIT_LABELS.closeButtonAria }),
    );

    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("「また あした くる」ボタンで onDismiss が呼ばれる", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <RateLimitModal detail={{ kind: "user", message: "x" }} onDismiss={onDismiss} />,
    );

    await user.click(
      screen.getByRole("button", { name: RATE_LIMIT_LABELS.dismissButton }),
    );

    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("バックドロップ (ダイアログ外) クリックで onDismiss が呼ばれる", () => {
    const onDismiss = vi.fn();
    render(
      <RateLimitModal detail={{ kind: "user", message: "x" }} onDismiss={onDismiss} />,
    );

    // バックドロップを直接クリックする。dialog 内のクリックは伝播停止される仕様。
    fireEvent.click(screen.getByTestId("rate-limit-backdrop"));

    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
