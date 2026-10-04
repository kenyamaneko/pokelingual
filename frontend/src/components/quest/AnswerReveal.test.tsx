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

// 段階の切り替えは再描画で次の段のタイマーを登録し直すため、段階境界をまたぐ時間経過は act() を分けて進める。
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
  describe("正常系", () => {
    describe("「英語版の図鑑の説明」の欄がまだ画面内に入っていないとき", () => {
      it("時間が経っても、「英語版の図鑑の説明」は表示されない", () => {
        setIntersectionAutoTrigger(false);
        renderAnswerReveal();
        advance(FADE_DURATION_MS * 2);
        expect(screen.getByTestId("quest-text-reveal")).toHaveAttribute("data-state", "hidden");
      });

      it("欄が画面内に入ると、「英語版の図鑑の説明」が表示される", () => {
        setIntersectionAutoTrigger(false);
        renderAnswerReveal();
        const questTextEl = screen.getByTestId("quest-text-reveal");
        act(() => {
          triggerIntersection(questTextEl, true);
        });
        expect(questTextEl).toHaveAttribute("data-state", "revealed");
      });
    });

    it("「英語版の図鑑の説明」のフェードインが終わる直前のとき、「君の翻訳」は表示されない", () => {
      renderAnswerReveal();
      advance(FADE_DURATION_MS - 1);
      expect(screen.getByTestId("translation-reveal")).toHaveAttribute("data-state", "hidden");
    });

    it("「英語版の図鑑の説明」のフェードインが終わったとき、「君の翻訳」が表示される", () => {
      renderAnswerReveal();
      advance(FADE_DURATION_MS);
      expect(screen.getByTestId("translation-reveal")).toHaveAttribute("data-state", "revealed");
    });

    it("「君の翻訳」のフェードインが終わる直前のとき、「解答例」の欄には文字が 1 文字も表示されていない", () => {
      renderAnswerReveal();
      advance(FADE_DURATION_MS);
      advance(FADE_DURATION_MS - 1);
      expect(screen.getByTestId("description-text")).toHaveTextContent("「」");
    });

    describe("「君の翻訳」のフェードインが終わったとき", () => {
      it("1文字分の時間が経つと、「解答例」の先頭の 1 文字が表示される", () => {
        renderAnswerReveal();
        advanceToDescriptionStage();
        advance(CHAR_INTERVAL_MS);
        expect(screen.getByTestId("description-text")).toHaveTextContent(`「${DESCRIPTION_JA[0]}」`);
      });

      it("全文字分の時間が経つと、「解答例」が全文表示される", () => {
        renderAnswerReveal();
        advanceToDescriptionStage();
        advance(CHAR_INTERVAL_MS * DESCRIPTION_JA.length);
        expect(screen.getByTestId("description-text")).toHaveTextContent(`「${DESCRIPTION_JA}」`);
      });
    });

    describe("「解答例」を全文表示し終えたとき", () => {
      it("1文字分の時間が経つ前は、「博士からのコメント」に文字が 1 文字も表示されていない", () => {
        renderAnswerReveal();
        advanceToReviewStage();
        advance(CHAR_INTERVAL_MS - 1);
        expect(screen.getByTestId("review-text")).toBeEmptyDOMElement();
      });

      it("1文字分の時間が経つと、「博士からのコメント」の先頭の 1 文字が表示される", () => {
        renderAnswerReveal();
        advanceToReviewStage();
        advance(CHAR_INTERVAL_MS);
        expect(screen.getByTestId("review-text")).toHaveTextContent(REVIEW[0]);
      });

      it("全文字分の時間が経つと、「博士からのコメント」が全文表示される", () => {
        renderAnswerReveal();
        advanceToReviewStage();
        advance(CHAR_INTERVAL_MS * REVIEW.length);
        expect(screen.getByTestId("review-text")).toHaveTextContent(REVIEW);
      });
    });

    it("「博士からのコメント」の表示が終わっていないとき、HP は 100% と表示される", () => {
      renderAnswerReveal();
      advanceToReviewStage();
      advance(CHAR_INTERVAL_MS);
      expect(screen.getByText("100%")).toBeInTheDocument();
    });

    it("スコアが 85 で「博士からのコメント」を全文表示し終えた後、メーターの減少が終わると、HP が 15% と表示される", () => {
      renderAnswerReveal();
      advanceToMeterStage();
      advance(METER_ANIMATION_DURATION_MS);
      expect(screen.getByText("15%")).toBeInTheDocument();
    });

    it("採点結果画面を表示すると、見出し「英語版の図鑑の説明」が表示される", () => {
      renderAnswerReveal();
      expect(screen.getByText("英語版の図鑑の説明")).toBeInTheDocument();
    });
  });
});
