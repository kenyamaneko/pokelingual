import { render, screen, act } from "@testing-library/react";
import { describe, expect, vi, beforeEach, afterEach } from "vitest";
import {
  TutorialInstructionCallout,
  INSTRUCTION_APPEAR_DELAY_MS,
  INVALID_ANSWER_SHAKE_DURATION_MS,
} from "./TutorialInstructionCallout";
import { defineCase } from "../../test/defineCase";

const CALLOUT_CONTENT = "タイトルが「この英文を訳してみよう」、案内文が「テスト用の案内文」";

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
          When: ["チュートリアル画面のステップの開始時に、案内の吹き出しの表示を始める"],
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
          When: ["チュートリアル画面のステップの開始時に、案内の吹き出しの表示を始める", "チュートリアル画面のステップが始まってから 600 ミリ秒待つ"],
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
          Given: `${CALLOUT_CONTENT}で、誤答が 3 回あった状態のとき`,
          When: ["チュートリアル画面で、案内の吹き出しを表示する"],
          Then: "吹き出しは揺れていない",
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
          Given: `${CALLOUT_CONTENT}の吹き出しが表示されていて、誤答が 0 回のとき`,
          When: ["チュートリアル画面で、入力が誤答と判定されて誤答が 1 回になる"],
          Then: "吹き出しが揺れる",
        },
      ],
    },
    () => {
      const { rerenderWithSignal } = renderVisibleCallout(0);

      rerenderWithSignal(1);

      expect(screen.getByRole("note")).toHaveAttribute("data-state", "invalid");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: `${CALLOUT_CONTENT}の吹き出しが表示されていて、誤答が 1 回判定されていて、吹き出しが揺れているとき`,
          When: ["チュートリアル画面の吹き出しの揺れが始まってから 400 ミリ秒待つ"],
          Then: "揺れが収まる",
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
