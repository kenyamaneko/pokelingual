import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  TutorialInstructionCallout,
  INSTRUCTION_APPEAR_DELAY_MS,
  INVALID_ANSWER_SHAKE_DURATION_MS,
} from "./TutorialInstructionCallout";

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

  describe("タイトルが「この英文を訳してみよう」、案内文が「テスト用の案内文」の吹き出しがステップの開始時に描画されたとき", () => {
    describe("単体テスト", () => {
      describe("正常系", () => {
        it("ステップが始まった直後は、案内文「テスト用の案内文」が表示されていない", () => {
          renderCallout();
          expect(screen.getByText("テスト用の案内文")).not.toBeVisible();
        });

        it("ステップが始まってから 600 ミリ秒が経つと、タイトル「この英文を訳してみよう」と案内文「テスト用の案内文」が表示される", () => {
          renderCallout();
          act(() => {
            vi.advanceTimersByTime(INSTRUCTION_APPEAR_DELAY_MS);
          });
          expect(screen.getByText("この英文を訳してみよう")).toBeVisible();
          expect(screen.getByText("テスト用の案内文")).toBeVisible();
        });
      });
    });
  });
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

  describe("タイトルが「この英文を訳してみよう」、案内文が「テスト用の案内文」の吹き出しが表示されているとき", () => {
    describe("単体テスト", () => {
      describe("異常系", () => {
        it("誤答が 3 回あった状態で表示された吹き出しは、揺れていない", () => {
          renderVisibleCallout(3);

          expect(screen.getByRole("note")).toHaveAttribute("data-state", "idle");
        });

        it("誤答が 0 回の状態で、入力が誤答と判定されて誤答が 1 回になると、吹き出しが揺れる", () => {
          const { rerenderWithSignal } = renderVisibleCallout(0);

          rerenderWithSignal(1);

          expect(screen.getByRole("note")).toHaveAttribute("data-state", "invalid");
        });

        it("誤答が 1 回判定されて吹き出しが揺れているとき、400 ミリ秒が経つと、揺れが収まる", () => {
          const { rerenderWithSignal } = renderVisibleCallout(0);
          rerenderWithSignal(1);

          act(() => {
            vi.advanceTimersByTime(INVALID_ANSWER_SHAKE_DURATION_MS);
          });

          expect(screen.getByRole("note")).toHaveAttribute("data-state", "idle");
        });
      });
    });
  });
});
