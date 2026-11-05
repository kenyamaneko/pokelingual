import { render, screen, act } from "@testing-library/react";
import { describe, expect, vi, beforeEach, afterEach } from "vitest";
import { AnswerReveal } from "./AnswerReveal";
import { METER_ANIMATION_DURATION_MS } from "./ScoreDisplay";
import { CHAR_INTERVAL_MS } from "./TypewriterText";
import { FADE_DURATION_MS } from "../../hooks/useFadeReveal";
import {
  setIntersectionAutoTrigger,
  triggerIntersection,
} from "../../test/intersectionObserverMock";
import type { ScoreResponse } from "../../../../shared/api-types/quest";
import { defineCase } from "../../test/defineCase";

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

function advanceToDescriptionStage() {
  advance(FADE_DURATION_MS);
  advance(FADE_DURATION_MS);
}

function advanceToReviewStage() {
  advanceToDescriptionStage();
  advance(CHAR_INTERVAL_MS * DESCRIPTION_JA.length);
}

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

const SHOW_RESULT_SCREEN = "採点結果画面を表示して、各欄の段階的開示を始める";
const ALL_FIELDS_IN_VIEW = "すべての欄が画面内に入っているとき";
const WAIT_FOR_TRANSLATION_FADE_IN = "採点結果画面の段階的開示で、「英語版の図鑑の説明」のフェードインが終わるまで待つ";
const WAIT_FOR_DESCRIPTION_COMPLETE = "採点結果画面の段階的開示で、「解答例」を全文表示し終えるまで待つ";
const WAIT_ONE_CHAR = "採点結果画面の段階的開示で、1 文字分の時間を待つ";

describe("[本体:採点]採点結果画面の段階的開示", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "「英語版の図鑑の説明」の欄がまだ画面内に入っていないとき",
          When: [SHOW_RESULT_SCREEN, "採点結果画面の段階的開示で、「英語版の図鑑の説明」のフェードイン 2 回分の時間を待つ"],
          Then: "「英語版の図鑑の説明」は表示されない",
        },
      ],
    },
    () => {
      setIntersectionAutoTrigger(false);
      renderAnswerReveal();
      advance(FADE_DURATION_MS * 2);
      expect(screen.getByTestId("quest-text-reveal")).toHaveAttribute("data-state", "hidden");
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "「英語版の図鑑の説明」の欄がまだ画面内に入っていないとき",
          When: [SHOW_RESULT_SCREEN, "採点結果画面の段階的開示で、「英語版の図鑑の説明」の欄を画面内に入れる"],
          Then: "「英語版の図鑑の説明」が表示される",
        },
      ],
    },
    () => {
      setIntersectionAutoTrigger(false);
      renderAnswerReveal();
      const questTextEl = screen.getByTestId("quest-text-reveal");
      act(() => {
        triggerIntersection(questTextEl, true);
      });
      expect(questTextEl).toHaveAttribute("data-state", "revealed");
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: ALL_FIELDS_IN_VIEW,
          When: [SHOW_RESULT_SCREEN, "採点結果画面の段階的開示で、「英語版の図鑑の説明」のフェードインが終わる直前まで待つ"],
          Then: "「君の翻訳」は表示されない",
        },
      ],
    },
    () => {
      renderAnswerReveal();
      advance(FADE_DURATION_MS - 1);
      expect(screen.getByTestId("translation-reveal")).toHaveAttribute("data-state", "hidden");
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: ALL_FIELDS_IN_VIEW,
          When: [SHOW_RESULT_SCREEN, WAIT_FOR_TRANSLATION_FADE_IN],
          Then: "「君の翻訳」が表示される",
        },
      ],
    },
    () => {
      renderAnswerReveal();
      advance(FADE_DURATION_MS);
      expect(screen.getByTestId("translation-reveal")).toHaveAttribute("data-state", "revealed");
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: ALL_FIELDS_IN_VIEW,
          When: [SHOW_RESULT_SCREEN, WAIT_FOR_TRANSLATION_FADE_IN, "採点結果画面の段階的開示で、「君の翻訳」のフェードインが終わる直前まで待つ"],
          Then: "「解答例」の欄には文字が 1 文字も表示されていない",
        },
      ],
    },
    () => {
      renderAnswerReveal();
      advance(FADE_DURATION_MS);
      advance(FADE_DURATION_MS - 1);
      expect(screen.getByTestId("description-text")).toHaveTextContent("「」");
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: ALL_FIELDS_IN_VIEW,
          When: [SHOW_RESULT_SCREEN, WAIT_FOR_DESCRIPTION_COMPLETE, "採点結果画面の段階的開示で、「博士からのコメント」の先頭の 1 文字「い」が表示されるまで待つ"],
          Then: "「博士からのコメント」の表示が終わっていない間、HP は 100% と表示される",
        },
      ],
    },
    () => {
      renderAnswerReveal();
      advanceToReviewStage();
      advance(CHAR_INTERVAL_MS);
      expect(screen.getByText("100%")).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "スコアが 85 で、すべての欄が画面内に入っているとき",
          When: [SHOW_RESULT_SCREEN, "採点結果画面の段階的開示で、「博士からのコメント」を全文表示し終えるまで待つ", "採点結果画面の段階的開示で、HP バーの減少が終わるまで待つ"],
          Then: "HP が 15% と表示される",
        },
      ],
    },
    () => {
      renderAnswerReveal();
      advanceToMeterStage();
      advance(METER_ANIMATION_DURATION_MS);
      expect(screen.getByText("15%")).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: ALL_FIELDS_IN_VIEW,
          When: [SHOW_RESULT_SCREEN, WAIT_FOR_TRANSLATION_FADE_IN, WAIT_ONE_CHAR],
          Then: "「解答例」の先頭の 1 文字「テ」が表示される",
        },
      ],
    },
    () => {
      renderAnswerReveal();
      advanceToDescriptionStage();
      advance(CHAR_INTERVAL_MS);
      expect(screen.getByTestId("description-text")).toHaveTextContent("「テ」");
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: ALL_FIELDS_IN_VIEW,
          When: [SHOW_RESULT_SCREEN, WAIT_FOR_TRANSLATION_FADE_IN, "採点結果画面の段階的開示で、「解答例」の文字数 (9 文字) 分の時間を待つ"],
          Then: "「解答例」が「テストの せつめい」と全文表示される",
        },
      ],
    },
    () => {
      renderAnswerReveal();
      advanceToDescriptionStage();
      advance(CHAR_INTERVAL_MS * DESCRIPTION_JA.length);
      expect(screen.getByTestId("description-text")).toHaveTextContent("「テストの せつめい」");
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: ALL_FIELDS_IN_VIEW,
          When: [SHOW_RESULT_SCREEN, WAIT_FOR_DESCRIPTION_COMPLETE, "採点結果画面の段階的開示で、1 文字分の時間が経つ直前まで待つ"],
          Then: "「博士からのコメント」には文字が 1 文字も表示されていない",
        },
      ],
    },
    () => {
      renderAnswerReveal();
      advanceToReviewStage();
      advance(CHAR_INTERVAL_MS - 1);
      expect(screen.getByTestId("review-text")).toBeEmptyDOMElement();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: ALL_FIELDS_IN_VIEW,
          When: [SHOW_RESULT_SCREEN, WAIT_FOR_DESCRIPTION_COMPLETE, WAIT_ONE_CHAR],
          Then: "「博士からのコメント」の先頭の 1 文字「い」が表示される",
        },
      ],
    },
    () => {
      renderAnswerReveal();
      advanceToReviewStage();
      advance(CHAR_INTERVAL_MS);
      expect(screen.getByTestId("review-text")).toHaveTextContent("い");
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: ALL_FIELDS_IN_VIEW,
          When: [SHOW_RESULT_SCREEN, WAIT_FOR_DESCRIPTION_COMPLETE, "採点結果画面の段階的開示で、「博士からのコメント」の文字数 (3 文字) 分の時間を待つ"],
          Then: "「博士からのコメント」が「いいね」と全文表示される",
        },
      ],
    },
    () => {
      renderAnswerReveal();
      advanceToReviewStage();
      advance(CHAR_INTERVAL_MS * REVIEW.length);
      expect(screen.getByTestId("review-text")).toHaveTextContent("いいね");
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          When: [SHOW_RESULT_SCREEN],
          Then: "見出し「英語版の図鑑の説明」が表示される",
        },
      ],
    },
    () => {
      renderAnswerReveal();
      expect(screen.getByText("英語版の図鑑の説明")).toBeInTheDocument();
    },
  );
});
