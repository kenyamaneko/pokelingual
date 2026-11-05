import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ScoreDisplay,
  METER_ANIMATION_DURATION_MS,
  DAMAGE_REVEAL_DELAY_MS,
} from "./ScoreDisplay";
import type { ScoreResponse } from "../../../../shared/api-types/quest";
import { spec } from "../../test/labels";

function withScore(score: number): ScoreResponse {
  return { score, review: "", description_ja: "" };
}

function renderScoreDisplayAfter(score: number, elapsedMs: number) {
  render(<ScoreDisplay score={withScore(score)} isActive={true} />);
  act(() => {
    vi.advanceTimersByTime(elapsedMs);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("[本体:採点]採点スコアの演出", () => {
  describe("HP の減少が始まった直後のとき", () => {
    describe("単体テスト", () => {
      describe("正常系", () => {
        it("HP バーが 100% を示す", () => {
          renderScoreDisplayAfter(30, 0);
          expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "100");
        });

        it("HP の数値が 100% と表示される", () => {
          renderScoreDisplayAfter(30, 0);
          expect(screen.getByText("100%")).toBeInTheDocument();
        });
      });
    });
  });

  describe("スコアが 30 のとき", () => {
    describe("単体テスト", () => {
      describe("正常系", () => {
        it("HP の減少にかかる時間の半分が経った時点では、HP バーが 85% を示す", () => {
          renderScoreDisplayAfter(30, METER_ANIMATION_DURATION_MS / 2);
          expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "85");
        });

        it("HP の減少にかかる時間の半分が経った時点では、HP の数値が 85% と表示される", () => {
          renderScoreDisplayAfter(30, METER_ANIMATION_DURATION_MS / 2);
          expect(screen.getByText("85%")).toBeInTheDocument();
        });

        it("HP の減少が終わった時点では、HP バーが 70% を示す", () => {
          renderScoreDisplayAfter(30, METER_ANIMATION_DURATION_MS);
          expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "70");
        });

        it("HP の減少が終わった時点では、HP の数値が 70% と表示される", () => {
          renderScoreDisplayAfter(30, METER_ANIMATION_DURATION_MS);
          expect(screen.getByText("70%")).toBeInTheDocument();
        });

        it("HP の減少が終わった時点では、ダメージ数値がまだ表示されていない", () => {
          renderScoreDisplayAfter(30, METER_ANIMATION_DURATION_MS);
          expect(screen.queryByTestId("damage-value")).not.toBeInTheDocument();
        });

        it("HP の減少が終わった時点では、こうか表示「効果は　いまひとつのようだ」がまだ表示されていない", () => {
          renderScoreDisplayAfter(30, METER_ANIMATION_DURATION_MS);
          expect(screen.queryByText(spec("効果は　いまひとつのようだ"))).not.toBeInTheDocument();
        });

        it("HP の減少が終わってからダメージ数値を出すまでの間が経つと、ダメージ数値が 30% と表示される", () => {
          renderScoreDisplayAfter(30, METER_ANIMATION_DURATION_MS + DAMAGE_REVEAL_DELAY_MS);
          expect(screen.getByText("30%")).toBeInTheDocument();
        });

        it("HP の減少が終わってからこうか表示を出すまでの間が経つと、こうか表示「効果は　いまひとつのようだ」が表示される", () => {
          renderScoreDisplayAfter(30, METER_ANIMATION_DURATION_MS + DAMAGE_REVEAL_DELAY_MS);
          expect(screen.getByText(spec("効果は　いまひとつのようだ"))).toBeInTheDocument();
        });
      });
    });
  });

  describe("スコアが 85 のとき", () => {
    describe("単体テスト", () => {
      describe("正常系", () => {
        it("HP の減少にかかる時間の 6 割が経った時点では、HP バーが 49% を示す", () => {
          renderScoreDisplayAfter(85, METER_ANIMATION_DURATION_MS * 0.6);
          expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "49");
        });

        it("HP の減少が終わった時点では、HP バーが 15% を示す", () => {
          renderScoreDisplayAfter(85, METER_ANIMATION_DURATION_MS);
          expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "15");
        });
      });
    });
  });

  describe("単体テスト", () => {
    describe("正常系", () => {
      it.each([
        { score: 85, timing: "HP の減少が始まった直後", elapsedRatio: 0, remainingHp: 100 },
        { score: 49, timing: "HP の減少が終わった時点", elapsedRatio: 1, remainingHp: 51 },
      ])(
        "スコアが $score で、$timing で残り HP が $remainingHp% のとき、HP バーの色は緑になる",
        ({ score, elapsedRatio }) => {
          renderScoreDisplayAfter(score, METER_ANIMATION_DURATION_MS * elapsedRatio);
          expect(screen.getByTestId("hp-bar")).toHaveAttribute("data-hp-band", "green");
        },
      );

      it.each([
        { score: 85, timing: "HP の減少にかかる時間の 6 割が経った時点", elapsedRatio: 0.6, remainingHp: 49 },
        { score: 50, timing: "HP の減少が終わった時点", elapsedRatio: 1, remainingHp: 50 },
        { score: 79, timing: "HP の減少が終わった時点", elapsedRatio: 1, remainingHp: 21 },
      ])(
        "スコアが $score で、$timing で残り HP が $remainingHp% のとき、HP バーの色は黄になる",
        ({ score, elapsedRatio }) => {
          renderScoreDisplayAfter(score, METER_ANIMATION_DURATION_MS * elapsedRatio);
          expect(screen.getByTestId("hp-bar")).toHaveAttribute("data-hp-band", "yellow");
        },
      );

      it.each([
        { score: 85, timing: "HP の減少が終わった時点", elapsedRatio: 1, remainingHp: 15 },
        { score: 80, timing: "HP の減少が終わった時点", elapsedRatio: 1, remainingHp: 20 },
      ])(
        "スコアが $score で、$timing で残り HP が $remainingHp% のとき、HP バーの色は赤になる",
        ({ score, elapsedRatio }) => {
          renderScoreDisplayAfter(score, METER_ANIMATION_DURATION_MS * elapsedRatio);
          expect(screen.getByTestId("hp-bar")).toHaveAttribute("data-hp-band", "red");
        },
      );
    });
  });
});
