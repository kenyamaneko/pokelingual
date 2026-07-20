import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  TutorialInstructionCallout,
  INSTRUCTION_APPEAR_DELAY_MS,
  INVALID_ANSWER_SHAKE_DURATION_MS,
} from "./TutorialInstructionCallout";

describe("[チュートリアル] チュートリアルの案内表示", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderCallout() {
    render(<TutorialInstructionCallout title="この英文を訳してみよう" instruction="テスト用の案内文" />);
  }

  it("ステップが始まった直後は、案内はまだ表示されない", () => {
    renderCallout();
    expect(screen.getByText("テスト用の案内文")).not.toBeVisible();
  });

  it("ステップ開始から一定の遅延が経過すると、タイトルと案内文が表示される", () => {
    renderCallout();
    act(() => {
      vi.advanceTimersByTime(INSTRUCTION_APPEAR_DELAY_MS);
    });
    expect(screen.getByText("この英文を訳してみよう")).toBeVisible();
    expect(screen.getByText("テスト用の案内文")).toBeVisible();
  });
});

describe("[チュートリアル] チュートリアル案内の誤答シェイク", () => {
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

  it("新しく表示された案内は、警告状態から始まらない", () => {
    renderVisibleCallout(3);

    expect(screen.getByRole("note")).toHaveAttribute("data-state", "idle");
  });

  it("誤答が新たに伝えられると、警告状態になる", () => {
    const { rerenderWithSignal } = renderVisibleCallout(0);

    rerenderWithSignal(1);

    expect(screen.getByRole("note")).toHaveAttribute("data-state", "invalid");
  });

  it("警告状態は、シェイクの再生時間が経過すると解除される", () => {
    const { rerenderWithSignal } = renderVisibleCallout(0);
    rerenderWithSignal(1);

    act(() => {
      vi.advanceTimersByTime(INVALID_ANSWER_SHAKE_DURATION_MS);
    });

    expect(screen.getByRole("note")).toHaveAttribute("data-state", "idle");
  });
});
