import { render, screen, act } from "@testing-library/react";
import { describe, expect, vi, beforeEach, afterEach } from "vitest";
import {
  CaptureEffect,
  SHAKE_DURATION_MS,
  EFFECT_DURATION_MS,
  WHITEOUT_DURATION_MS,
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

const SHOW_EFFECT = "捕獲演出を表示する";

describe("[本体:捕獲]捕獲演出", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "ボールの揺れの再生中のとき",
          When: [SHOW_EFFECT],
          Then: "捕獲の成否を示すエフェクトは表示されない",
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
          Given: "捕獲の成否を示すエフェクトの再生が終わったとき",
          When: [SHOW_EFFECT],
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
          Given: "白フェードの再生が終わったとき",
          When: [SHOW_EFFECT],
          Then: "結果画面へ切り替える指示が 1 回出される",
        },
      ],
    },
    () => {
      const onComplete = renderEffect(true);
      advance(SHAKE_DURATION_MS);
      advance(EFFECT_DURATION_MS);
      advance(WHITEOUT_DURATION_MS);
      expect(onComplete).toHaveBeenCalledTimes(1);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "ボールの揺れの再生が終わった時点で、捕獲に成功したとき",
          When: [SHOW_EFFECT],
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
          Given: "ボールの揺れの再生が終わった時点で、捕獲に失敗したとき",
          When: [SHOW_EFFECT],
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
