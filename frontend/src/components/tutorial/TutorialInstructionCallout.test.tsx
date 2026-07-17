import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TutorialInstructionCallout, INSTRUCTION_APPEAR_DELAY_MS } from "./TutorialInstructionCallout";

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
