import { render, screen } from "@testing-library/react";
import { describe, expect, vi, beforeEach, afterEach } from "vitest";
import { spec } from "../../test/labels";
import { defineCase } from "../../test/defineCase";
import { RateLimitModal, formatUntilJstMidnight } from "./RateLimitModal";

const SHOW_MODAL = "日次上限モーダルを表示する";

describe("[本体:AI 呼び出し回数]日次上限モーダル", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: "ユーザーの日次上限に達したとき",
          When: [SHOW_MODAL],
          Then: "「博士は忙しそうにしている」と表示される",
        },
      ],
    },
    () => {
      render(
        <RateLimitModal
          detail={{ kind: "user", message: "x" }}
          onDismiss={vi.fn()}
        />,
      );
      expect(screen.getByText(spec("博士は忙しそうにしている"))).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: "全体の日次上限に達したとき",
          When: [SHOW_MODAL],
          Then: "「研究所は大にぎわいのようだ」と表示される",
        },
      ],
    },
    () => {
      render(
        <RateLimitModal
          detail={{ kind: "global", message: "x" }}
          onDismiss={vi.fn()}
        />,
      );
      expect(screen.getByText(spec("研究所は大にぎわいのようだ"))).toBeInTheDocument();
    },
  );
});

describe("[本体:AI 呼び出し回数]日次上限のリセットまでの残り時間表示", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  for (const { currentTime, jstTime, remaining } of [
    { currentTime: "2026-01-01T23:59:59+09:00", jstTime: "23:59:59", remaining: "00:00:01" },
    { currentTime: "2026-01-02T00:00:00+09:00", jstTime: "0:00:00", remaining: "00:00:00" },
    { currentTime: "2026-01-02T00:00:01+09:00", jstTime: "0:00:01", remaining: "23:59:59" },
    { currentTime: "2026-01-02T12:34:56+09:00", jstTime: "12:34:56", remaining: "11:25:04" },
    { currentTime: "2026-01-02T14:50:51+09:00", jstTime: "14:50:51", remaining: "09:09:09" },
  ]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        steps: [
          {
            Given: `現在時刻が JST ${jstTime} のとき`,
            When: ["リセットまでの残り時間を求める"],
            Then: `リセットまでの残り時間は ${remaining} になる`,
          },
        ],
      },
      () => {
        vi.setSystemTime(new Date(currentTime));
        expect(formatUntilJstMidnight()).toBe(remaining);
      },
    );
  }
});
