import { render, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TypewriterText, CHAR_INTERVAL_MS } from "./TypewriterText";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("[本体:クエスト]文章のタイプライター演出", () => {
  describe("単体テスト", () => {
    describe("正常系", () => {
      it("文章「ABC」の演出が始まる前のとき、文字が表示されない", () => {
        const { container } = render(<TypewriterText text="ABC" isActive={false} />);
        expect(container.textContent).toBe("");
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

  describe("3 文字の文章「ABC」の演出が始まったとき", () => {
    describe("単体テスト", () => {
      describe("正常系", () => {
        it("1 文字分の時間が経つと、先頭の 1 文字「A」が表示される", () => {
          const { container } = render(<TypewriterText text="ABC" isActive={true} />);
          act(() => {
            vi.advanceTimersByTime(CHAR_INTERVAL_MS);
          });
          expect(container.textContent).toBe("A");
        });

        it("3 文字分の時間が経つと、3 文字が「ABC」と全文表示される", () => {
          const { container } = render(<TypewriterText text="ABC" isActive={true} />);
          act(() => {
            vi.advanceTimersByTime(CHAR_INTERVAL_MS * 3);
          });
          expect(container.textContent).toBe("ABC");
        });
      });
    });
  });
});
