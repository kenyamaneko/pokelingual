import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AnswerReveal } from "./AnswerReveal";
import { METER_ANIMATION_DURATION_MS } from "./ScoreDisplay";
import { CHAR_INTERVAL_MS } from "./TypewriterText";
import { FADE_DURATION_MS } from "../../hooks/useFadeReveal";
import {
  setIntersectionAutoTrigger,
  triggerIntersection,
} from "../../test/intersectionObserverMock";
import type { ScoreResponse } from "../../../../shared/api-types/quest";

/**
 * AnswerReveal の仕様:
 * 出題英文 → 君の翻訳 → 解答例 → 博士のコメント → HP メーターの順に、各段が
 * 「前段階の完了」かつ「要素の初可視化」の両方を満たしたときに開示される。
 *
 * 段階の切り替わりは、次の段のタイマー登録を伴う React の再描画をまたぐため、
 * 段階境界をまたぐ advance は個別の act() 呼び出しに分ける (1回の advance にまとめると
 * 新しく登録されるタイマーの起点がずれる)。
 */
const DESCRIPTION_EN = "A wild creature roams.";
const USER_TRANSLATION = "やくぶん";
const REVIEW = "いいね";
const DESCRIPTION_JA = "テストの せつめい";

function buildScore(): ScoreResponse {
  return { score: 85, review: REVIEW, description_ja: DESCRIPTION_JA };
}

function renderAnswerReveal() {
  render(
    <AnswerReveal
      description={DESCRIPTION_EN}
      userTranslation={USER_TRANSLATION}
      score={buildScore()}
    />,
  );
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/** 出題英文・君の翻訳のフェードを終え、解答例の開示が始まる状態まで進める。 */
function advanceToDescriptionStage() {
  advance(FADE_DURATION_MS);
  advance(FADE_DURATION_MS);
}

/** 解答例の表示を終え、博士のコメントの開示が始まる状態まで進める。 */
function advanceToReviewStage() {
  advanceToDescriptionStage();
  advance(CHAR_INTERVAL_MS * DESCRIPTION_JA.length);
}

/** 博士のコメントの表示を終え、HP メーターの開示が始まる状態まで進める。 */
function advanceToMeterStage() {
  advanceToReviewStage();
  advance(CHAR_INTERVAL_MS * REVIEW.length);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("[クエスト] 採点結果画面の段階的開示", () => {
  it("要素が可視化されるまでは、出題英文の表示が始まらない", () => {
    setIntersectionAutoTrigger(false);
    renderAnswerReveal();
    advance(FADE_DURATION_MS * 2);
    expect(screen.getByTestId("quest-text-reveal")).toHaveAttribute("data-state", "hidden");
  });

  it("要素が可視化されると、出題英文の表示が始まる", () => {
    setIntersectionAutoTrigger(false);
    renderAnswerReveal();
    const questTextEl = screen.getByTestId("quest-text-reveal");
    act(() => {
      triggerIntersection(questTextEl, true);
    });
    expect(questTextEl).toHaveAttribute("data-state", "revealed");
  });

  it("出題英文のフェードが終わるまでは、君の翻訳の表示が始まらない", () => {
    renderAnswerReveal();
    advance(FADE_DURATION_MS - 1);
    expect(screen.getByTestId("translation-reveal")).toHaveAttribute("data-state", "hidden");
  });

  it("出題英文のフェードが終わると、君の翻訳の表示が始まる", () => {
    renderAnswerReveal();
    advance(FADE_DURATION_MS);
    expect(screen.getByTestId("translation-reveal")).toHaveAttribute("data-state", "revealed");
  });

  it("君の翻訳のフェードが終わるまでは、解答例が表示されない", () => {
    renderAnswerReveal();
    advance(FADE_DURATION_MS);
    advance(FADE_DURATION_MS - 1);
    expect(screen.getByTestId("description-text")).toHaveTextContent("「」");
  });

  it("君の翻訳のフェードが終わると、解答例が1文字ずつ表示され最終的に全文になる", () => {
    renderAnswerReveal();
    advanceToDescriptionStage();
    advance(CHAR_INTERVAL_MS);
    expect(screen.getByTestId("description-text")).toHaveTextContent(`「${DESCRIPTION_JA[0]}」`);

    advance(CHAR_INTERVAL_MS * DESCRIPTION_JA.length);
    expect(screen.getByTestId("description-text")).toHaveTextContent(`「${DESCRIPTION_JA}」`);
  });

  it("解答例の表示が終わるまでは、博士のコメントが表示されない", () => {
    renderAnswerReveal();
    advanceToDescriptionStage();
    advance(CHAR_INTERVAL_MS * DESCRIPTION_JA.length);
    advance(CHAR_INTERVAL_MS - 1);
    expect(screen.getByTestId("review-text")).toBeEmptyDOMElement();
  });

  it("博士のコメントは、1文字ずつ表示され最終的に全文になる", () => {
    renderAnswerReveal();
    advanceToReviewStage();
    advance(CHAR_INTERVAL_MS);
    expect(screen.getByTestId("review-text")).toHaveTextContent(REVIEW[0]);

    advance(CHAR_INTERVAL_MS * REVIEW.length);
    expect(screen.getByTestId("review-text")).toHaveTextContent(REVIEW);
  });

  it("博士のコメントの表示が終わるまでは、HP は満タンの 100% のまま表示される", () => {
    renderAnswerReveal();
    advanceToReviewStage();
    advance(CHAR_INTERVAL_MS);
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("スコア 85 のとき、博士のコメントが全文表示された後に HP が減少して残り 15% と表示される", () => {
    renderAnswerReveal();
    advanceToMeterStage();
    advance(METER_ANIMATION_DURATION_MS);
    expect(screen.getByText("15%")).toBeInTheDocument();
  });

  it("採点結果画面の出題英文の上に、英語版の図鑑の説明であることを示すラベルが表示される", () => {
    renderAnswerReveal();
    expect(screen.getByText("英語版の図鑑の説明")).toBeInTheDocument();
  });
});
