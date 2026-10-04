import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TypewriterText, CHAR_INTERVAL_MS } from "./TypewriterText";

describe("[クエスト] 文章のタイプライター演出", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("正常系", () => {
    it("演出が始まる前のとき、文字が表示されない", () => {
      render(<TypewriterText text="ABC" isActive={false} />);
      expect(screen.queryByText("A", { exact: false })).not.toBeInTheDocument();
    });

    describe("3 文字の文章の演出が始まったとき", () => {
      it("1文字分の時間が経つと、先頭の 1 文字が表示される", () => {
        const { container } = render(<TypewriterText text="ABC" isActive={true} />);
        act(() => {
          vi.advanceTimersByTime(CHAR_INTERVAL_MS);
        });
        expect(container.textContent).toBe("A");
      });

      it("3文字分の時間が経つと、3 文字が全文表示される", () => {
        const { container } = render(<TypewriterText text="ABC" isActive={true} />);
        act(() => {
          vi.advanceTimersByTime(CHAR_INTERVAL_MS * 3);
        });
        expect(container.textContent).toBe("ABC");
      });
    });

    it("表示する文章が空のとき、演出が始まって 1 文字分の時間が経っても、何も表示されない", () => {
      const { container } = render(<TypewriterText text="" isActive={true} />);
      act(() => {
        vi.advanceTimersByTime(CHAR_INTERVAL_MS);
      });
      expect(container.textContent).toBe("");
    });
  });
});
