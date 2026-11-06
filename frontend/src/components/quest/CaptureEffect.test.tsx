import { render, screen, act } from "@testing-library/react";
import { describe, expect, vi, beforeEach, afterEach } from "vitest";
import {
  CaptureEffect,
  SHAKE_DURATION_MS,
  EFFECT_DURATION_MS,
} from "./CaptureEffect";
import { defineCase } from "../../test/defineCase";

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

const SHOW_EFFECT = "捕獲演出を始める";
const WAIT_FOR_SHAKE = "ボールの揺れの再生が終わるまで待つ";
const WAIT_FOR_EFFECT = "ボールの揺れと、捕獲の成否を示すエフェクトの再生が終わるまで待つ";

describe("[本体:捕獲]捕獲演出", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          When: [SHOW_EFFECT],
          Then: "ボールの揺れの再生中は、捕獲の成否を示すエフェクトは表示されない",
        },
      ],
    },
    () => {
      renderEffect(true);
      expect(screen.queryByTestId("capture-effect-fx")).not.toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          When: [SHOW_EFFECT, WAIT_FOR_EFFECT],
          Then: "白フェードが表示される",
        },
      ],
    },
    () => {
      renderEffect(true);
      advance(SHAKE_DURATION_MS);
      advance(EFFECT_DURATION_MS);
      expect(screen.getByTestId("capture-whiteout")).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "捕獲に成功しているとき",
          When: [SHOW_EFFECT, WAIT_FOR_SHAKE],
          Then: "花火風のエフェクトが表示される",
        },
      ],
    },
    () => {
      renderEffect(true);
      advance(SHAKE_DURATION_MS);
      expect(screen.getByTestId("capture-effect-fx")).toHaveAttribute("data-state", "success");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "捕獲に失敗しているとき",
          When: [SHOW_EFFECT, WAIT_FOR_SHAKE],
          Then: "煙幕風のエフェクトが表示される",
        },
      ],
    },
    () => {
      renderEffect(false);
      advance(SHAKE_DURATION_MS);
      expect(screen.getByTestId("capture-effect-fx")).toHaveAttribute("data-state", "failure");
    },
  );
});
