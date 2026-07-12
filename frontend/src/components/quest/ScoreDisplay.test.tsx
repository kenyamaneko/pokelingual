import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ScoreDisplay, METER_ANIMATION_DURATION_MS } from "./ScoreDisplay";
import { SCORE_LABELS } from "../../utils/scoreLabel";
import type { ScoreResponse } from "../../../../shared/api-types/quest";
import { spec } from "../../test/labels";

/**
 * ScoreDisplay の仕様:
 * - HP 表示は 100 - score
 * - こうかラベルは、ダメージメーターのアニメーションが完了してから表示する
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
  it("スコア 35 のとき、相手の残り HP が 65/100 と表示される", () => {
    render(<ScoreDisplay score={withScore(35)} />);
    expect(screen.getByText("65/100")).toBeInTheDocument();
  });

  it("メーターのアニメーション完了前は、こうかラベルを出さない", () => {
    render(<ScoreDisplay score={withScore(85)} />);
    expect(screen.queryByText(spec(SCORE_LABELS.superEffective))).not.toBeInTheDocument();
  });

  it("メーターのアニメーション完了後は、スコアに応じたこうかラベルを出す", () => {
    render(<ScoreDisplay score={withScore(85)} />);
    act(() => {
      vi.advanceTimersByTime(METER_ANIMATION_DURATION_MS);
    });
    expect(screen.getByText(spec(SCORE_LABELS.superEffective))).toBeInTheDocument();
  });
});
