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

const TEXT_GREETING = "表示する文章が「こんにちは」のとき";
const START_TYPEWRITER = "文章のタイプライター演出を始める";

describe("[本体:クエスト]文章のタイプライター演出", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "表示する文章が「こんにちは」で、演出をまだ始めていないとき",
          When: ["文章のタイプライター演出を表示する"],
          Then: "何も表示されない",
        },
      ],
    },
    () => {
      const { container } = render(<TypewriterText text="こんにちは" isActive={false} />);
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
          When: [START_TYPEWRITER, "文章の表示が終わるまで待つ"],
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
          Given: TEXT_GREETING,
          When: [START_TYPEWRITER, "先頭の 1 文字の表示が終わるまで待つ"],
          Then: "先頭の 1 文字「こ」が表示される",
        },
      ],
    },
    () => {
      const { container } = render(<TypewriterText text="こんにちは" isActive={true} />);
      act(() => {
        vi.advanceTimersByTime(CHAR_INTERVAL_MS);
      });
      expect(container.textContent).toBe("こ");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: TEXT_GREETING,
          When: [START_TYPEWRITER, "文章の表示が終わるまで待つ"],
          Then: "「こんにちは」が全文表示される",
        },
      ],
    },
    () => {
      const { container } = render(<TypewriterText text="こんにちは" isActive={true} />);
      act(() => {
        vi.advanceTimersByTime(CHAR_INTERVAL_MS * 5);
      });
      expect(container.textContent).toBe("こんにちは");
    },
  );
});
