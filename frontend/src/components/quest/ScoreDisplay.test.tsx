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

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("[クエスト] 採点スコアの演出", () => {
  describe("正常系", () => {
    describe("メーターの減少が始まった直後のとき", () => {
      it("メーターが 100% を示す", () => {
        render(<ScoreDisplay score={withScore(30)} isActive={true} />);
        expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "100");
      });

      it("HP が 100% と表示される", () => {
        render(<ScoreDisplay score={withScore(30)} isActive={true} />);
        expect(screen.getByText("100%")).toBeInTheDocument();
      });

      it("HP バーの色が緑になる", () => {
        render(<ScoreDisplay score={withScore(85)} isActive={true} />);
        expect(screen.getByTestId("hp-bar")).toHaveAttribute("data-hp-band", "green");
      });
    });

    describe("スコアが 30 のとき", () => {
      it("メーターの減少の中間時点では、メーターが 85% を示す", () => {
        render(<ScoreDisplay score={withScore(30)} isActive={true} />);
        act(() => {
          vi.advanceTimersByTime(METER_ANIMATION_DURATION_MS / 2);
        });
        expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "85");
      });

      it("メーターの減少の中間時点では、HP が 85% と表示される", () => {
        render(<ScoreDisplay score={withScore(30)} isActive={true} />);
        act(() => {
          vi.advanceTimersByTime(METER_ANIMATION_DURATION_MS / 2);
        });
        expect(screen.getByText("85%")).toBeInTheDocument();
      });

      it("メーターの減少が終わった時点では、メーターが 70% を示す", () => {
        render(<ScoreDisplay score={withScore(30)} isActive={true} />);
        act(() => {
          vi.advanceTimersByTime(METER_ANIMATION_DURATION_MS);
        });
        expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "70");
      });

      it("メーターの減少が終わった時点では、HP が 70% と表示される", () => {
        render(<ScoreDisplay score={withScore(30)} isActive={true} />);
        act(() => {
          vi.advanceTimersByTime(METER_ANIMATION_DURATION_MS);
        });
        expect(screen.getByText("70%")).toBeInTheDocument();
      });

      it("メーターの減少が終わった時点では、ダメージ数値がまだ表示されていない", () => {
        render(<ScoreDisplay score={withScore(30)} isActive={true} />);
        act(() => {
          vi.advanceTimersByTime(METER_ANIMATION_DURATION_MS);
        });
        expect(screen.queryByTestId("damage-value")).not.toBeInTheDocument();
      });

      it("メーターの減少が終わった時点では、「効果は　いまひとつのようだ」がまだ表示されていない", () => {
        render(<ScoreDisplay score={withScore(30)} isActive={true} />);
        act(() => {
          vi.advanceTimersByTime(METER_ANIMATION_DURATION_MS);
        });
        expect(screen.queryByText(spec("効果は　いまひとつのようだ"))).not.toBeInTheDocument();
      });

      it("メーターの減少が終わって少し経つと、ダメージが 30% と表示される", () => {
        render(<ScoreDisplay score={withScore(30)} isActive={true} />);
        act(() => {
          vi.advanceTimersByTime(METER_ANIMATION_DURATION_MS + DAMAGE_REVEAL_DELAY_MS);
        });
        expect(screen.getByText("30%")).toBeInTheDocument();
      });

      it("メーターの減少が終わって少し経つと、「効果は　いまひとつのようだ」と表示される", () => {
        render(<ScoreDisplay score={withScore(30)} isActive={true} />);
        act(() => {
          vi.advanceTimersByTime(METER_ANIMATION_DURATION_MS + DAMAGE_REVEAL_DELAY_MS);
        });
        expect(screen.getByText(spec("効果は　いまひとつのようだ"))).toBeInTheDocument();
      });
    });

    describe("スコアが 85 のとき", () => {
      it("メーターの減少の途中で HP の表示値が 50% 以下になった時点では、HP バーの色が黄になる", () => {
        render(<ScoreDisplay score={withScore(85)} isActive={true} />);
        act(() => {
          vi.advanceTimersByTime(METER_ANIMATION_DURATION_MS * 0.6);
        });
        expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "49");
        expect(screen.getByTestId("hp-bar")).toHaveAttribute("data-hp-band", "yellow");
      });

      it("メーターの減少が終わって残り HP が 15% のとき、HP バーの色が赤になる", () => {
        render(<ScoreDisplay score={withScore(85)} isActive={true} />);
        act(() => {
          vi.advanceTimersByTime(METER_ANIMATION_DURATION_MS);
        });
        expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "15");
        expect(screen.getByTestId("hp-bar")).toHaveAttribute("data-hp-band", "red");
      });
    });

    describe("メーターの減少が終わった時点", () => {
      it.each([
        ["残り HP が 51% のとき、HP バーの色は緑になる", 49, "green"],
        ["残り HP が 50% のとき、HP バーの色は黄になる", 50, "yellow"],
        ["残り HP が 21% のとき、HP バーの色は黄になる", 79, "yellow"],
        ["残り HP が 20% のとき、HP バーの色は赤になる", 80, "red"],
      ] as const)("%s", (_name, score, band) => {
        render(<ScoreDisplay score={withScore(score)} isActive={true} />);
        act(() => {
          vi.advanceTimersByTime(METER_ANIMATION_DURATION_MS);
        });
        expect(screen.getByTestId("hp-bar")).toHaveAttribute("data-hp-band", band);
      });
    });
  });
});
