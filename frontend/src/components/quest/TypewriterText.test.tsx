import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TypewriterText, CHAR_INTERVAL_MS } from "./TypewriterText";

/**
 * TypewriterText の仕様:
 * 有効化されるまでは何も表示せず、有効化後は一定間隔で1文字ずつ表示していく。
 */
describe("タイプライター表示", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("有効化前は、文字が表示されない", () => {
    render(<TypewriterText text="ABC" isActive={false} />);
    expect(screen.queryByText("A", { exact: false })).not.toBeInTheDocument();
  });

  it("有効化から一定時間後、先頭の1文字が表示される", () => {
    const { container } = render(<TypewriterText text="ABC" isActive={true} />);
    act(() => {
      vi.advanceTimersByTime(CHAR_INTERVAL_MS);
    });
    expect(container.textContent).toBe("A");
  });

  it("有効化から3文字分の時間が経過すると、全文字が表示される", () => {
    const { container } = render(<TypewriterText text="ABC" isActive={true} />);
    act(() => {
      vi.advanceTimersByTime(CHAR_INTERVAL_MS * 3);
    });
    expect(container.textContent).toBe("ABC");
  });

  it("表示する文章が空のとき、有効化しても何も表示されない", () => {
    const { container } = render(<TypewriterText text="" isActive={true} />);
    act(() => {
      vi.advanceTimersByTime(CHAR_INTERVAL_MS);
    });
    expect(container.textContent).toBe("");
  });
});
