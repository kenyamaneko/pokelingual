import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  CaptureEffect,
  SHAKE_DURATION_MS,
  EFFECT_DURATION_MS,
} from "./CaptureEffect";

describe("捕獲演出", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderEffect(captured: boolean, onComplete = vi.fn()) {
    render(
      <CaptureEffect
        ballSprite="https://example.com/ball.png"
        ballName="テストボール"
        captured={captured}
        onComplete={onComplete}
      />,
    );
    return onComplete;
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

  it("エフェクトの再生完了前は、演出の完了を通知しない", () => {
    const onComplete = renderEffect(true);
    act(() => {
      vi.advanceTimersByTime(SHAKE_DURATION_MS);
    });
    act(() => {
      vi.advanceTimersByTime(EFFECT_DURATION_MS - 1);
    });
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("エフェクトの再生完了後、演出の完了を通知する", () => {
    const onComplete = renderEffect(true);
    act(() => {
      vi.advanceTimersByTime(SHAKE_DURATION_MS);
    });
    act(() => {
      vi.advanceTimersByTime(EFFECT_DURATION_MS);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
