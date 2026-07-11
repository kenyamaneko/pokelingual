import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CaptureEffect, SHAKE_DURATION_MS } from "./CaptureEffect";

describe("捕獲演出", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderEffect(captured: boolean) {
    render(
      <CaptureEffect
        ballSprite="https://example.com/ball.png"
        ballName="テストボール"
        captured={captured}
        onComplete={vi.fn()}
      />,
    );
  }

  it("揺れの再生中は、成否エフェクトを表示しない", () => {
    renderEffect(true);
    expect(screen.queryByTestId("capture-effect-fx")).not.toBeInTheDocument();
  });

  it("揺れの再生完了後、捕獲に成功したときは成功エフェクトを表示する", () => {
    renderEffect(true);
    act(() => {
      vi.advanceTimersByTime(SHAKE_DURATION_MS);
    });
    expect(screen.getByTestId("capture-effect-fx")).toHaveAttribute("data-state", "success");
  });

  it("揺れの再生完了後、捕獲に失敗したときは失敗エフェクトを表示する", () => {
    renderEffect(false);
    act(() => {
      vi.advanceTimersByTime(SHAKE_DURATION_MS);
    });
    expect(screen.getByTestId("capture-effect-fx")).toHaveAttribute("data-state", "failure");
  });
});
