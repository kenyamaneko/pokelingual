import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TranslationResult } from "./TranslationResult";
import { METER_ANIMATION_DURATION_MS } from "./ScoreDisplay";
import { CHAR_INTERVAL_MS } from "./TypewriterText";
import type { ScoreResponse } from "../../../../shared/api-types/quest";

/**
 * TranslationResult の仕様:
 * ダメージメーターのアニメーションが完了するまでは博士のコメントを表示せず、
 * 完了後にタイプライター演出で表示を始める。この演出状態は問題ごとに独立する。
 */
function buildScore(overrides: Partial<ScoreResponse> = {}): ScoreResponse {
  return { score: 85, review: "いいね", description_ja: "テストの せつめい", ...overrides };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("翻訳結果表示", () => {
  it("表示直後は、博士のコメントが表示されない", () => {
    render(<TranslationResult userTranslation="やくぶん" score={buildScore()} />);
    expect(screen.queryByText("いいね")).not.toBeInTheDocument();
  });

  it("ダメージメーターのアニメーション完了後、博士のコメントが1文字ずつ表示され最終的に全文になる", () => {
    render(<TranslationResult userTranslation="やくぶん" score={buildScore()} />);
    act(() => {
      vi.advanceTimersByTime(METER_ANIMATION_DURATION_MS);
    });
    act(() => {
      vi.advanceTimersByTime(CHAR_INTERVAL_MS);
    });
    expect(screen.getByText("い")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(CHAR_INTERVAL_MS * "いいね".length);
    });
    expect(screen.getByText("いいね")).toBeInTheDocument();
  });

  it("次の問題に進むと、前の問題の演出状態は引き継がれず、博士のコメントは表示されない", () => {
    const { unmount } = render(
      <TranslationResult userTranslation="やくぶん" score={buildScore()} />,
    );
    act(() => {
      vi.advanceTimersByTime(METER_ANIMATION_DURATION_MS);
    });
    act(() => {
      vi.advanceTimersByTime(CHAR_INTERVAL_MS);
    });
    expect(screen.getByText("い")).toBeInTheDocument();
    unmount();

    render(<TranslationResult userTranslation="つぎのやくぶん" score={buildScore()} />);
    expect(screen.queryByText("い")).not.toBeInTheDocument();
  });
});
