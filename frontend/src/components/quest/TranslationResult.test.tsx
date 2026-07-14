import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TranslationResult } from "./TranslationResult";
import { METER_ANIMATION_DURATION_MS } from "./ScoreDisplay";
import { CHAR_INTERVAL_MS } from "./TypewriterText";
import type { ScoreResponse } from "../../../../shared/api-types/quest";

/**
 * TranslationResult の仕様:
 * 博士のコメント → 日本語の説明文 → ダメージメーターの順に段階的に開示する
 * (博士のコメントが無いときは説明文から開示を始める)。この演出状態は問題ごとに独立する。
 */
const REVIEW = "いいね";
const DESCRIPTION = "テストの せつめい";

function buildScore(overrides: Partial<ScoreResponse> = {}): ScoreResponse {
  return { score: 85, review: REVIEW, description_ja: DESCRIPTION, ...overrides };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("翻訳結果表示", () => {
  it("表示直後から、博士のコメントが1文字ずつ表示され最終的に全文になる", () => {
    render(<TranslationResult userTranslation="やくぶん" score={buildScore()} />);
    act(() => {
      vi.advanceTimersByTime(CHAR_INTERVAL_MS);
    });
    expect(screen.getByText("い")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(CHAR_INTERVAL_MS * REVIEW.length);
    });
    expect(screen.getByText(REVIEW)).toBeInTheDocument();
  });

  it("博士のコメントの表示が終わるまでは、日本語の説明文が表示されない", () => {
    render(<TranslationResult userTranslation="やくぶん" score={buildScore()} />);
    act(() => {
      vi.advanceTimersByTime(CHAR_INTERVAL_MS);
    });
    expect(screen.getByText("「」")).toBeInTheDocument();
  });

  it("博士のコメントが全文表示された後、日本語の説明文が1文字ずつ表示される", () => {
    render(<TranslationResult userTranslation="やくぶん" score={buildScore()} />);
    act(() => {
      vi.advanceTimersByTime(CHAR_INTERVAL_MS * REVIEW.length);
    });
    act(() => {
      vi.advanceTimersByTime(CHAR_INTERVAL_MS);
    });
    expect(screen.getByText(`「${DESCRIPTION[0]}」`)).toBeInTheDocument();
  });

  it("博士のコメントが無いとき、表示直後から日本語の説明文が表示され始める", () => {
    render(
      <TranslationResult userTranslation="やくぶん" score={buildScore({ review: "" })} />,
    );
    act(() => {
      vi.advanceTimersByTime(CHAR_INTERVAL_MS);
    });
    expect(screen.getByText(`「${DESCRIPTION[0]}」`)).toBeInTheDocument();
  });

  it("日本語の説明文の表示が終わるまでは、HP は満タンの 100% のまま表示される", () => {
    render(<TranslationResult userTranslation="やくぶん" score={buildScore()} />);
    act(() => {
      vi.advanceTimersByTime(CHAR_INTERVAL_MS * REVIEW.length);
    });
    act(() => {
      vi.advanceTimersByTime(CHAR_INTERVAL_MS);
    });
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("スコア 85 のとき、日本語の説明文が全文表示された後に HP が減少して残り 15% と表示される", () => {
    render(<TranslationResult userTranslation="やくぶん" score={buildScore()} />);
    act(() => {
      vi.advanceTimersByTime(CHAR_INTERVAL_MS * REVIEW.length);
    });
    act(() => {
      vi.advanceTimersByTime(CHAR_INTERVAL_MS * DESCRIPTION.length);
    });
    act(() => {
      vi.advanceTimersByTime(METER_ANIMATION_DURATION_MS);
    });
    expect(screen.getByText("15%")).toBeInTheDocument();
  });

  it("次の問題に進むと、前の問題の演出状態は引き継がれず、博士のコメントは1文字目からやり直しになる", () => {
    const { unmount } = render(
      <TranslationResult userTranslation="やくぶん" score={buildScore()} />,
    );
    act(() => {
      vi.advanceTimersByTime(CHAR_INTERVAL_MS);
    });
    expect(screen.getByText("い")).toBeInTheDocument();
    unmount();

    render(<TranslationResult userTranslation="つぎのやくぶん" score={buildScore()} />);
    expect(screen.queryByText("い")).not.toBeInTheDocument();
  });
});
