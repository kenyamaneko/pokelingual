import { render, act } from "@testing-library/react";
import { describe, expect, vi, beforeEach, afterEach } from "vitest";
import { TypewriterText, CHAR_INTERVAL_MS } from "./TypewriterText";
import { defineCase } from "../../test/defineCase";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const THREE_CHAR_TEXT_STARTED = "3 文字の文章「ABC」の演出が始まっているとき";
const ONE_CHAR_INTERVAL_PASSES = "クエスト画面の文章のタイプライター演出で、1 文字分の時間が経つ";

describe("[本体:クエスト]文章のタイプライター演出", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "文章「ABC」の演出が始まる前のとき",
          When: ["クエスト画面に、タイプライター演出の文章を配置する"],
          Then: "文字が表示されない",
        },
      ],
    },
    () => {
      const { container } = render(<TypewriterText text="ABC" isActive={false} />);
      expect(container.textContent).toBe("");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["件数・有無", "エッジケース"],
      steps: [
        {
          Given: "表示する文章が空のとき",
          When: ["クエスト画面で、文章のタイプライター演出を始める", ONE_CHAR_INTERVAL_PASSES],
          Then: "何も表示されない",
        },
      ],
    },
    () => {
      const { container } = render(<TypewriterText text="" isActive={true} />);
      act(() => {
        vi.advanceTimersByTime(CHAR_INTERVAL_MS);
      });
      expect(container.textContent).toBe("");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: THREE_CHAR_TEXT_STARTED,
          When: [ONE_CHAR_INTERVAL_PASSES],
          Then: "先頭の 1 文字「A」が表示される",
        },
      ],
    },
    () => {
      const { container } = render(<TypewriterText text="ABC" isActive={true} />);
      act(() => {
        vi.advanceTimersByTime(CHAR_INTERVAL_MS);
      });
      expect(container.textContent).toBe("A");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["境界値"],
      steps: [
        {
          Given: THREE_CHAR_TEXT_STARTED,
          When: ["クエスト画面の文章のタイプライター演出で、3 文字分の時間が経つ"],
          Then: "3 文字が「ABC」と全文表示される",
        },
      ],
    },
    () => {
      const { container } = render(<TypewriterText text="ABC" isActive={true} />);
      act(() => {
        vi.advanceTimersByTime(CHAR_INTERVAL_MS * 3);
      });
      expect(container.textContent).toBe("ABC");
    },
  );
});
