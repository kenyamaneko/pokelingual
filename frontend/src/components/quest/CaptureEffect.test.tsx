import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  CaptureEffect,
  SHAKE_DURATION_MS,
  EFFECT_DURATION_MS,
  WHITEOUT_DURATION_MS,
} from "./CaptureEffect";

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

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("[本体:捕獲]捕獲演出", () => {
  describe("単体テスト", () => {
    describe("正常系", () => {
      it("ボールの揺れの再生中のとき、捕獲の成否を示すエフェクトは表示されない", () => {
        renderEffect(true);
        expect(screen.queryByTestId("capture-effect-fx")).not.toBeInTheDocument();
      });

      it("捕獲の成否を示すエフェクトの再生が終わったとき、白フェードが表示される", () => {
        renderEffect(true);
        advance(SHAKE_DURATION_MS);
        advance(EFFECT_DURATION_MS);
        expect(screen.getByTestId("capture-whiteout")).toBeInTheDocument();
      });

      it("白フェードの再生が終わったとき、結果画面へ切り替える指示が 1 回出される", () => {
        const onComplete = renderEffect(true);
        advance(SHAKE_DURATION_MS);
        advance(EFFECT_DURATION_MS);
        advance(WHITEOUT_DURATION_MS);
        expect(onComplete).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("ボールの揺れの再生が終わったとき", () => {
    describe("単体テスト", () => {
      describe("正常系", () => {
        it("捕獲に成功したとき、花火風のエフェクトが表示される", () => {
          renderEffect(true);
          advance(SHAKE_DURATION_MS);
          expect(screen.getByTestId("capture-effect-fx")).toHaveAttribute("data-state", "success");
        });

        it("捕獲に失敗したとき、煙幕風のエフェクトが表示される", () => {
          renderEffect(false);
          advance(SHAKE_DURATION_MS);
          expect(screen.getByTestId("capture-effect-fx")).toHaveAttribute("data-state", "failure");
        });
      });
    });
  });
});
