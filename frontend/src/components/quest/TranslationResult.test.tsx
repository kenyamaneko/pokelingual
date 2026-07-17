import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TranslationResult } from "./TranslationResult";
import { METER_ANIMATION_DURATION_MS } from "./ScoreDisplay";
import { CHAR_INTERVAL_MS } from "./TypewriterText";
import type { ScoreResponse } from "../../../../shared/api-types/quest";

/**
 * TranslationResult の仕様:
 * 博士のコメント → 日本語の説明文 → ダメージメーターの順に段階的に開示する。
 */
const REVIEW = "いいね";
const DESCRIPTION = "テストの せつめい";

function buildScore(): ScoreResponse {
  return { score: 85, review: REVIEW, description_ja: DESCRIPTION };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("[クエスト] 翻訳結果表示", () => {
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

  it("日本語の説明文は、1文字ずつ表示され最終的に全文になる", () => {
    render(<TranslationResult userTranslation="やくぶん" score={buildScore()} />);
    act(() => {
      vi.advanceTimersByTime(CHAR_INTERVAL_MS * REVIEW.length);
    });
    act(() => {
      vi.advanceTimersByTime(CHAR_INTERVAL_MS);
    });
    expect(screen.getByText(`「${DESCRIPTION[0]}」`)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(CHAR_INTERVAL_MS * DESCRIPTION.length);
    });
    expect(screen.getByText(`「${DESCRIPTION}」`)).toBeInTheDocument();
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
});
