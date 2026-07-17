import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ScoreDisplay,
  METER_ANIMATION_DURATION_MS,
  DAMAGE_REVEAL_DELAY_MS,
} from "./ScoreDisplay";
import { SCORE_LABELS } from "../../utils/scoreLabel";
import type { ScoreResponse } from "../../../../shared/api-types/quest";
import { spec } from "../../test/labels";

/**
 * ScoreDisplay の仕様:
 * - isActive になると、メーターと HP 数値が満タンから残量まで連動して減少する
 * - メーターの減少が終わってから、ダメージ数値とこうかラベルを表示する
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

describe("[クエスト] 採点スコアの演出", () => {
  it("メーターの減少が始まった直後は、メーターが満タンで HP が 100% と表示される", () => {
    render(<ScoreDisplay score={withScore(30)} isActive={true} />);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("スコア 30 のとき、メーターの減少の中間時点ではメーターも HP も 85% を指す", () => {
    render(<ScoreDisplay score={withScore(30)} isActive={true} />);
    act(() => {
      vi.advanceTimersByTime(METER_ANIMATION_DURATION_MS / 2);
    });
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "85");
    expect(screen.getByText("85%")).toBeInTheDocument();
  });

  it("スコア 30 のとき、メーターの減少が終わった時点ではメーターも HP も残り 70% を指す", () => {
    render(<ScoreDisplay score={withScore(30)} isActive={true} />);
    act(() => {
      vi.advanceTimersByTime(METER_ANIMATION_DURATION_MS);
    });
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "70");
    expect(screen.getByText("70%")).toBeInTheDocument();
  });

  it("メーターの減少が終わった時点では、ダメージ数値をまだ表示しない", () => {
    render(<ScoreDisplay score={withScore(30)} isActive={true} />);
    act(() => {
      vi.advanceTimersByTime(METER_ANIMATION_DURATION_MS);
    });
    expect(screen.queryByTestId("damage-value")).not.toBeInTheDocument();
  });

  it("メーターの減少が終わった時点では、こうかラベルをまだ表示しない", () => {
    render(<ScoreDisplay score={withScore(30)} isActive={true} />);
    act(() => {
      vi.advanceTimersByTime(METER_ANIMATION_DURATION_MS);
    });
    expect(screen.queryByText(spec(SCORE_LABELS.notVeryEffective))).not.toBeInTheDocument();
  });

  it("スコア 30 のとき、メーターの減少が終わった後にダメージが 30% と表示される", () => {
    render(<ScoreDisplay score={withScore(30)} isActive={true} />);
    act(() => {
      vi.advanceTimersByTime(METER_ANIMATION_DURATION_MS + DAMAGE_REVEAL_DELAY_MS);
    });
    expect(screen.getByTestId("damage-value")).toHaveTextContent("30%");
  });

  it("スコア 30 のとき、メーターの減少が終わった後にこうかラベルが表示される", () => {
    render(<ScoreDisplay score={withScore(30)} isActive={true} />);
    act(() => {
      vi.advanceTimersByTime(METER_ANIMATION_DURATION_MS + DAMAGE_REVEAL_DELAY_MS);
    });
    expect(screen.getByText(spec(SCORE_LABELS.notVeryEffective))).toBeInTheDocument();
  });
});
