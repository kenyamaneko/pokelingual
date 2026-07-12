import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { spec } from "../../test/labels";
import {
  RateLimitModal,
  RATE_LIMIT_LABELS,
  formatUntilJstMidnight,
} from "./RateLimitModal";

/**
 * RateLimitModal の仕様:
 * - kind ("user" / "global") に応じてタイトルが切り替わる
 *
 * 各操作 (× / 「また あした くる」 / バックドロップ) でモーダルを閉じる振る舞いは、
 * 実際にモーダルが画面から消える結果を観測するため rateLimitFlow.test.tsx (公開入口からの
 * 結合) で確かめる。
 * カウントダウンの表示文字列は GUI では検証しない (画面上の見せ方は変わりうる)。
 * 残時間計算のロジックは formatUntilJstMidnight の単体テストで境界を固定する。
 */
describe("利用上限モーダル", () => {
  it("自分の利用上限に達したときは、個人向けタイトルを出す", () => {
    render(
      <RateLimitModal
        detail={{ kind: "user", message: "x" }}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText(spec(RATE_LIMIT_LABELS.userTitle))).toBeInTheDocument();
  });

  it("全体の利用上限に達したときは、全体向けタイトルを出す", () => {
    render(
      <RateLimitModal
        detail={{ kind: "global", message: "x" }}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText(spec(RATE_LIMIT_LABELS.globalTitle))).toBeInTheDocument();
  });
});

/**
 * formatUntilJstMidnight の仕様:
 * - ローカルタイムゾーンに依存せず、JST 翌日 0:00 までの残時間を hh:mm:ss で返す
 * - JST 0:00 ちょうどの瞬間はリセット済み (再挑戦可能) として 00:00:00 を返す
 */
describe("利用リセットまでの残り時間表示 (JST 0:00 境界)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // JST = UTC+9 なので JST 0:00 は UTC の前日 15:00:00。
  it.each([
    ["JST 23:59:59 (リセット 1 秒前) では、残り時間 00:00:01 になる", "2026-01-01T14:59:59.000Z", "00:00:01"],
    ["JST 0:00:00 (リセットの瞬間) では、残り時間 00:00:00 になる", "2026-01-01T15:00:00.000Z", "00:00:00"],
    ["JST 0:00:01 (リセット 1 秒後) では、残り時間 23:59:59 になる", "2026-01-01T15:00:01.000Z", "23:59:59"],
    ["JST 12:34:56 (日中) では、残り時間 11:25:04 になる", "2026-01-02T03:34:56.000Z", "11:25:04"],
    ["残り時間が 9 時間 9 分 9 秒 (1 桁) のときは、ゼロパディングされた 09:09:09 になる", "2026-01-02T05:50:51.000Z", "09:09:09"],
  ])("%s", (_name, nowUtc, expected) => {
    vi.setSystemTime(new Date(nowUtc));

    expect(formatUntilJstMidnight()).toBe(expected);
  });
});
