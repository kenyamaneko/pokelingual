import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { spec } from "../../test/labels";
import { RateLimitModal, formatUntilJstMidnight } from "./RateLimitModal";

describe("[本体:AI 呼び出し回数]日次上限モーダル", () => {
  describe("単体テスト", () => {
    describe("異常系", () => {
      it("ユーザーの日次上限に達したとき、「博士は忙しそうにしている」と表示される", () => {
        render(
          <RateLimitModal
            detail={{ kind: "user", message: "x" }}
            onDismiss={vi.fn()}
          />,
        );
        expect(screen.getByText(spec("博士は忙しそうにしている"))).toBeInTheDocument();
      });

      it("全体の日次上限に達したとき、「研究所は大にぎわいのようだ」と表示される", () => {
        render(
          <RateLimitModal
            detail={{ kind: "global", message: "x" }}
            onDismiss={vi.fn()}
          />,
        );
        expect(screen.getByText(spec("研究所は大にぎわいのようだ"))).toBeInTheDocument();
      });
    });
  });
});

describe("[本体:AI 呼び出し回数]日次上限のリセットまでの残り時間表示", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("単体テスト", () => {
    describe("正常系", () => {
      it("現在時刻が JST 23:59:59 のとき、リセットまでの残り時間は 00:00:01 になる", () => {
        vi.setSystemTime(new Date("2026-01-01T23:59:59+09:00"));
        expect(formatUntilJstMidnight()).toBe("00:00:01");
      });

      it("現在時刻が JST 0:00:00 のとき、リセットまでの残り時間は 00:00:00 になる", () => {
        vi.setSystemTime(new Date("2026-01-02T00:00:00+09:00"));
        expect(formatUntilJstMidnight()).toBe("00:00:00");
      });

      it("現在時刻が JST 0:00:01 のとき、リセットまでの残り時間は 23:59:59 になる", () => {
        vi.setSystemTime(new Date("2026-01-02T00:00:01+09:00"));
        expect(formatUntilJstMidnight()).toBe("23:59:59");
      });

      it("現在時刻が JST 12:34:56 のとき、リセットまでの残り時間は 11:25:04 になる", () => {
        vi.setSystemTime(new Date("2026-01-02T12:34:56+09:00"));
        expect(formatUntilJstMidnight()).toBe("11:25:04");
      });

      it("現在時刻が JST 14:50:51 のとき、リセットまでの残り時間は 09:09:09 になる", () => {
        vi.setSystemTime(new Date("2026-01-02T14:50:51+09:00"));
        expect(formatUntilJstMidnight()).toBe("09:09:09");
      });
    });
  });
});
