import { render, screen, act } from "@testing-library/react";
import { describe, expect, vi, beforeEach, afterEach } from "vitest";
import {
  TutorialInstructionCallout,
  INSTRUCTION_APPEAR_DELAY_MS,
  INVALID_ANSWER_SHAKE_DURATION_MS,
} from "./TutorialInstructionCallout";
import { defineCase } from "../../test/defineCase";

const CALLOUT_CONTENT = "タイトルが「この英文を訳してみよう」、案内文が「テスト用の案内文」";

const START_CALLOUT = "案内の吹き出しの表示を始める";
const WAIT_FOR_CALLOUT_APPEAR = "案内の吹き出しが表示されるまで待つ";
const CALLOUT_NOT_SHAKING = "案内の吹き出しは揺れていない";

describe("[本体:チュートリアル]案内の吹き出しの表示", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderCallout() {
    render(<TutorialInstructionCallout title="この英文を訳してみよう" instruction="テスト用の案内文" />);
  }

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: `${CALLOUT_CONTENT}のとき`,
          When: [START_CALLOUT],
          Then: "案内文「テスト用の案内文」が表示されていない",
        },
      ],
    },
    () => {
      renderCallout();
      expect(screen.getByText("テスト用の案内文")).not.toBeVisible();
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: `${CALLOUT_CONTENT}のとき`,
          When: [START_CALLOUT, WAIT_FOR_CALLOUT_APPEAR],
          Then: "タイトル「この英文を訳してみよう」と案内文「テスト用の案内文」が表示される",
        },
      ],
    },
    () => {
      renderCallout();
      act(() => {
        vi.advanceTimersByTime(INSTRUCTION_APPEAR_DELAY_MS);
      });
      expect(screen.getByText("この英文を訳してみよう")).toBeVisible();
      expect(screen.getByText("テスト用の案内文")).toBeVisible();
    },
  );
});

describe("[本体:チュートリアル]誤答時の案内の吹き出しの揺れ", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // getByRole は visibility:hidden の要素を対象外にするため (RTL の既定挙動)、先に表示状態へ進めておく。
  function renderVisibleCallout(invalidAnswerSignal: number) {
    const result = render(
      <TutorialInstructionCallout
        title="この英文を訳してみよう"
        instruction="テスト用の案内文"
        invalidAnswerSignal={invalidAnswerSignal}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(INSTRUCTION_APPEAR_DELAY_MS);
    });
    const rerenderWithSignal = (nextSignal: number) => {
      result.rerender(
        <TutorialInstructionCallout
          title="この英文を訳してみよう"
          instruction="テスト用の案内文"
          invalidAnswerSignal={nextSignal}
        />,
      );
    };
    return { ...result, rerenderWithSignal };
  }

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: `${CALLOUT_CONTENT}で、誤答が 3 回あったとき`,
          When: [START_CALLOUT, WAIT_FOR_CALLOUT_APPEAR],
          Then: CALLOUT_NOT_SHAKING,
        },
      ],
    },
    () => {
      renderVisibleCallout(3);

      expect(screen.getByRole("note")).toHaveAttribute("data-state", "idle");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: `${CALLOUT_CONTENT}の吹き出しが表示されていて、誤答が 1 回判定されていて、吹き出しが揺れているとき`,
          When: ["案内の吹き出しの揺れの再生が終わるまで待つ"],
          Then: CALLOUT_NOT_SHAKING,
        },
      ],
    },
    () => {
      const { rerenderWithSignal } = renderVisibleCallout(0);
      rerenderWithSignal(1);

      act(() => {
        vi.advanceTimersByTime(INVALID_ANSWER_SHAKE_DURATION_MS);
      });

      expect(screen.getByRole("note")).toHaveAttribute("data-state", "idle");
    },
  );
});
