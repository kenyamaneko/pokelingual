import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  CaptureEffect,
  SHAKE_DURATION_MS,
  EFFECT_DURATION_MS,
  WHITEOUT_DURATION_MS,
} from "./CaptureEffect";

describe("[クエスト] 捕獲演出", () => {
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

  describe("正常系", () => {
    it("ボールの揺れの再生中のとき、成否エフェクトは表示されない", () => {
      renderEffect(true);
      expect(screen.queryByTestId("capture-effect-fx")).not.toBeInTheDocument();
    });

    describe("ボールの揺れの再生が終わったとき", () => {
      it("捕獲に成功したとき、花火風のエフェクトが表示される", () => {
        renderEffect(true);
        act(() => {
          vi.advanceTimersByTime(SHAKE_DURATION_MS);
        });
        expect(screen.getByTestId("capture-effect-fx")).toHaveAttribute("data-state", "success");
      });

      it("捕獲に失敗したとき、煙幕風のエフェクトが表示される", () => {
        renderEffect(false);
        act(() => {
          vi.advanceTimersByTime(SHAKE_DURATION_MS);
        });
        expect(screen.getByTestId("capture-effect-fx")).toHaveAttribute("data-state", "failure");
      });
    });

    it("成否エフェクトの再生が終わったとき、白フェードが表示される", () => {
      renderEffect(true);
      act(() => {
        vi.advanceTimersByTime(SHAKE_DURATION_MS);
      });
      act(() => {
        vi.advanceTimersByTime(EFFECT_DURATION_MS);
      });
      expect(screen.getByTestId("capture-whiteout")).toBeInTheDocument();
    });

    it("白フェードの再生が終わったとき、結果画面へ切り替える指示が 1 回出される", () => {
      const onComplete = renderEffect(true);
      act(() => {
        vi.advanceTimersByTime(SHAKE_DURATION_MS);
      });
      act(() => {
        vi.advanceTimersByTime(EFFECT_DURATION_MS);
      });
      act(() => {
        vi.advanceTimersByTime(WHITEOUT_DURATION_MS);
      });
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });
});
