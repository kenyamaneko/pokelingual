import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ScoreDisplay, METER_ANIMATION_DURATION_MS } from "./ScoreDisplay";
import { SCORE_LABELS } from "../../utils/scoreLabel";
import type { ScoreResponse } from "../../../../shared/api-types/quest";
import { spec } from "../../test/labels";

/**
 * ScoreDisplay の仕様:
 * - isActive になるまでは HP を満タンのまま表示し、ダメージ数値・こうかラベルは出さない
 * - isActive になると、HP バーとその数値表示が満タンから残量まで連動して減少する
 * - ダメージ数値とこうかラベルは、そのアニメーションが完了してから表示する
 */
function withScore(score: number): ScoreResponse {
  return { score, review: "", description_ja: "" };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("採点スコアの演出", () => {
  it("メーターのアニメーションが始まる前は、時間が経過しても HP は満タンの 100% のまま表示される", () => {
    render(<ScoreDisplay score={withScore(35)} isActive={false} />);
    act(() => {
      vi.advanceTimersByTime(METER_ANIMATION_DURATION_MS);
    });
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("スコア 35 のとき、メーターのアニメーション完了後に残り HP が 65% と表示される", () => {
    render(<ScoreDisplay score={withScore(35)} isActive={true} />);
    act(() => {
      vi.advanceTimersByTime(METER_ANIMATION_DURATION_MS);
    });
    expect(screen.getByText("65%")).toBeInTheDocument();
  });

  it("スコア 30 のとき、メーターのアニメーションの中間時点では HP が 85% と表示される", () => {
    render(<ScoreDisplay score={withScore(30)} isActive={true} />);
    act(() => {
      vi.advanceTimersByTime(METER_ANIMATION_DURATION_MS / 2);
    });
    expect(screen.getByText("85%")).toBeInTheDocument();
  });

  it("メーターのアニメーション完了前は、ダメージ数値を表示しない", () => {
    render(<ScoreDisplay score={withScore(85)} isActive={true} />);
    expect(screen.queryByTestId("damage-value")).not.toBeInTheDocument();
  });

  it("スコア 85 のとき、メーターのアニメーション完了後にダメージが 85% と表示される", () => {
    render(<ScoreDisplay score={withScore(85)} isActive={true} />);
    act(() => {
      vi.advanceTimersByTime(METER_ANIMATION_DURATION_MS);
    });
    expect(screen.getByTestId("damage-value")).toHaveTextContent("85%");
  });

  it("メーターのアニメーション完了前は、こうかラベルを出さない", () => {
    render(<ScoreDisplay score={withScore(85)} isActive={true} />);
    expect(screen.queryByText(spec(SCORE_LABELS.superEffective))).not.toBeInTheDocument();
  });

  it("メーターのアニメーション完了後は、スコアに応じたこうかラベルを出す", () => {
    render(<ScoreDisplay score={withScore(85)} isActive={true} />);
    act(() => {
      vi.advanceTimersByTime(METER_ANIMATION_DURATION_MS);
    });
    expect(screen.getByText(spec(SCORE_LABELS.superEffective))).toBeInTheDocument();
  });
});
