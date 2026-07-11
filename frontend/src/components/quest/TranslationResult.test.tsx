import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TranslationResult } from "./TranslationResult";
import { METER_ANIMATION_DURATION_MS, SCORE_LABELS } from "./ScoreDisplay";
import { CHAR_INTERVAL_MS } from "./TypewriterText";
import type { ScoreResponse } from "../../../../shared/api-types/quest";
import { spec } from "../../test/labels";

/**
 * TranslationResult の仕様:
 * ダメージメーターのアニメーションが完了するまでは、こうかラベルも博士のコメントも
 * 表示されない。完了後にこうかラベルが表示され、博士のコメントはタイプライター演出で
 * 表示が始まる。
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
  it("表示直後は、こうかラベルも博士のコメントも表示されない", () => {
    render(<TranslationResult userTranslation="やくぶん" score={buildScore()} />);
    expect(screen.queryByText(spec(SCORE_LABELS.superEffective))).not.toBeInTheDocument();
    expect(screen.queryByText("いいね")).not.toBeInTheDocument();
  });

  it("ダメージメーターのアニメーション完了後、こうかラベルが表示される", () => {
    render(<TranslationResult userTranslation="やくぶん" score={buildScore()} />);
    act(() => {
      vi.advanceTimersByTime(METER_ANIMATION_DURATION_MS);
    });
    expect(screen.getByText(spec(SCORE_LABELS.superEffective))).toBeInTheDocument();
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

  it("博士のコメントが空のとき、コメント欄は表示されない", () => {
    render(<TranslationResult userTranslation="やくぶん" score={buildScore({ review: "" })} />);
    act(() => {
      vi.advanceTimersByTime(METER_ANIMATION_DURATION_MS);
    });
    expect(screen.queryByText("博士からのコメント")).not.toBeInTheDocument();
  });

  it("次の問題で再マウントすると、前の問題のこうかラベルは引き継がれず表示されない", () => {
    const { unmount } = render(
      <TranslationResult userTranslation="やくぶん" score={buildScore()} />,
    );
    act(() => {
      vi.advanceTimersByTime(METER_ANIMATION_DURATION_MS);
    });
    expect(screen.getByText(spec(SCORE_LABELS.superEffective))).toBeInTheDocument();
    unmount();

    render(<TranslationResult userTranslation="つぎのやくぶん" score={buildScore()} />);
    expect(screen.queryByText(spec(SCORE_LABELS.superEffective))).not.toBeInTheDocument();
  });
});
