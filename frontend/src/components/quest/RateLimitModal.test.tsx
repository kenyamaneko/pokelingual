import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { spec } from "../../test/labels";
import { RateLimitModal, formatUntilJstMidnight } from "./RateLimitModal";

describe("[レート制限・利用回数] 利用上限モーダル", () => {
  describe("異常系", () => {
    it("自分の利用上限に達したとき、「博士は忙しそうにしている」と表示される", () => {
      render(
        <RateLimitModal
          detail={{ kind: "user", message: "x" }}
          onDismiss={vi.fn()}
        />,
      );
      expect(screen.getByText(spec("博士は忙しそうにしている"))).toBeInTheDocument();
    });

    it("全体の利用上限に達したとき、「研究所は大にぎわいのようだ」と表示される", () => {
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

describe("[レート制限・利用回数] 利用リセットまでの残り時間表示", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("正常系", () => {
    // JST は UTC+9 のため、JST 0:00 は UTC の前日 15:00:00 として指定する。
    it.each([
      ["JST 23:59:59 (リセット 1 秒前)", "00:00:01", "2026-01-01T14:59:59.000Z"],
      ["JST 0:00:00 (リセットの瞬間)", "00:00:00", "2026-01-01T15:00:00.000Z"],
      ["JST 0:00:01 (リセット 1 秒後)", "23:59:59", "2026-01-01T15:00:01.000Z"],
      ["JST 12:34:56 (日中)", "11:25:04", "2026-01-02T03:34:56.000Z"],
      ["残り時間が 9 時間 9 分 9 秒", "09:09:09", "2026-01-02T05:50:51.000Z"],
    ])("%s のとき、残り時間は %s と表示される", (_given, expected, nowUtc) => {
      vi.setSystemTime(new Date(nowUtc));

      expect(formatUntilJstMidnight()).toBe(expected);
    });
  });
});
