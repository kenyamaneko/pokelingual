import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  TutorialInstructionCallout,
  INSTRUCTION_APPEAR_DELAY_MS,
  INVALID_ANSWER_SHAKE_DURATION_MS,
} from "./TutorialInstructionCallout";

describe("[チュートリアル] 案内の吹き出しの表示", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderCallout() {
    render(<TutorialInstructionCallout title="この英文を訳してみよう" instruction="テスト用の案内文" />);
  }

  describe("正常系", () => {
    it("ステップが始まった直後は、案内の吹き出しが表示されていない", () => {
      renderCallout();
      expect(screen.getByText("テスト用の案内文")).not.toBeVisible();
    });

    it("ステップが始まってから表示の遅延時間が経つと、案内の吹き出しにタイトルと案内文が表示される", () => {
      renderCallout();
      act(() => {
        vi.advanceTimersByTime(INSTRUCTION_APPEAR_DELAY_MS);
      });
      expect(screen.getByText("この英文を訳してみよう")).toBeVisible();
      expect(screen.getByText("テスト用の案内文")).toBeVisible();
    });
  });
});

describe("[チュートリアル] 誤答時の案内の吹き出しの揺れ", () => {
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

  describe("異常系", () => {
    it("誤答があった状態で案内の吹き出しが新しく表示されたとき、吹き出しは揺れていない", () => {
      renderVisibleCallout(3);

      expect(screen.getByRole("note")).toHaveAttribute("data-state", "idle");
    });

    it("入力が誤答だったと新たに判定されたとき、吹き出しが揺れる", () => {
      const { rerenderWithSignal } = renderVisibleCallout(0);

      rerenderWithSignal(1);

      expect(screen.getByRole("note")).toHaveAttribute("data-state", "invalid");
    });

    it("入力が誤答だったと判定されて吹き出しが揺れているとき、揺れの再生時間が経つと、揺れが収まる", () => {
      const { rerenderWithSignal } = renderVisibleCallout(0);
      rerenderWithSignal(1);

      act(() => {
        vi.advanceTimersByTime(INVALID_ANSWER_SHAKE_DURATION_MS);
      });

      expect(screen.getByRole("note")).toHaveAttribute("data-state", "idle");
    });
  });
});
