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
import { spec } from "../../test/labels";

const DESCRIPTION_EN = "When several of these Pokémon gather, their electricity could build and cause lightning storms.";
const USER_TRANSLATION = "このポケモンが何匹か集まると、強い電気がたまって雷が落ちることがある";
const REVIEW = "雷の嵐という訳がよくできている。集まるの意味も正しく伝わっている。";
const DESCRIPTION_JA = "何匹か　あつまっていると そこでは　強い　電気が　たまり 雷が　落ちることが　あるという。";

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

const SHOW_RESULT_SCREEN = "採点結果画面を開く";
const ALL_FIELDS_IN_VIEW = "すべての欄が画面内に入っているとき";
const DESCRIPTION_JA_IS = "採点結果の日本語版の説明が「何匹か　あつまっていると そこでは　強い　電気が　たまり 雷が　落ちることが　あるという。」で、";
const REVIEW_IS = "採点結果の講評が「雷の嵐という訳がよくできている。集まるの意味も正しく伝わっている。」で、";
const WAIT_FOR_ENGLISH_DESCRIPTION_FADE_IN = "採点結果画面の段階的開示で、「英語版の図鑑の説明」のフェードインが終わるまで待つ";
const WAIT_FOR_DESCRIPTION_START = "採点結果画面の段階的開示で、「解答例」の表示が始まるまで待つ";
const WAIT_FOR_DESCRIPTION_COMPLETE = "採点結果画面の段階的開示で、「解答例」を全文表示し終えるまで待つ";
const WAIT_FOR_REVIEW_START = "採点結果画面の段階的開示で、「博士からのコメント」の表示が始まるまで待つ";
const WAIT_FOR_REVIEW_COMPLETE = "採点結果画面の段階的開示で、「博士からのコメント」を全文表示し終えるまで待つ";

describe("[本体:採点]採点結果画面の段階的開示", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "「英語版の図鑑の説明」の欄がまだ画面内に入っていないとき",
          When: [SHOW_RESULT_SCREEN],
          Then: "「英語版の図鑑の説明」は、表示が始まる前の状態のままで表示されない",
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
      観点: ["境界値"],
      steps: [
        {
          Given: ALL_FIELDS_IN_VIEW,
          When: [SHOW_RESULT_SCREEN],
          Then: "「英語版の図鑑の説明」のフェードインの途中は、「君の翻訳」は表示されない",
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
      観点: ["境界値"],
      steps: [
        {
          Given: ALL_FIELDS_IN_VIEW,
          When: [SHOW_RESULT_SCREEN, WAIT_FOR_ENGLISH_DESCRIPTION_FADE_IN],
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
          When: [SHOW_RESULT_SCREEN, WAIT_FOR_ENGLISH_DESCRIPTION_FADE_IN],
          Then: "「君の翻訳」のフェードインの途中は、「解答例」の欄には文字が 1 文字も表示されていない",
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
          When: [SHOW_RESULT_SCREEN, WAIT_FOR_DESCRIPTION_COMPLETE, WAIT_FOR_REVIEW_START],
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
          When: [SHOW_RESULT_SCREEN, WAIT_FOR_REVIEW_COMPLETE, "採点結果画面の段階的開示で、HP バーの減少が終わるまで待つ"],
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
          Given: `${DESCRIPTION_JA_IS}${ALL_FIELDS_IN_VIEW}`,
          When: [SHOW_RESULT_SCREEN, WAIT_FOR_ENGLISH_DESCRIPTION_FADE_IN, WAIT_FOR_DESCRIPTION_START],
          Then: "「解答例」の先頭の 1 文字「何」が表示される",
        },
      ],
    },
    () => {
      renderAnswerReveal();
      advanceToDescriptionStage();
      advance(CHAR_INTERVAL_MS);
      expect(screen.getByTestId("description-text")).toHaveTextContent("「何」");
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: `${DESCRIPTION_JA_IS}${ALL_FIELDS_IN_VIEW}`,
          When: [SHOW_RESULT_SCREEN, WAIT_FOR_ENGLISH_DESCRIPTION_FADE_IN, WAIT_FOR_DESCRIPTION_COMPLETE],
          Then: "「解答例」が「何匹か　あつまっていると そこでは　強い　電気が　たまり 雷が　落ちることが　あるという。」と全文表示される",
        },
      ],
    },
    () => {
      renderAnswerReveal();
      advanceToDescriptionStage();
      advance(CHAR_INTERVAL_MS * DESCRIPTION_JA.length);
      expect(screen.getByTestId("description-text")).toHaveTextContent(spec("「何匹か　あつまっていると そこでは　強い　電気が　たまり 雷が　落ちることが　あるという。」"));
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      観点: ["境界値"],
      steps: [
        {
          Given: ALL_FIELDS_IN_VIEW,
          When: [SHOW_RESULT_SCREEN, WAIT_FOR_DESCRIPTION_COMPLETE],
          Then: "「博士からのコメント」の表示が始まる前は、「博士からのコメント」には文字が 1 文字も表示されていない",
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
      観点: ["境界値"],
      steps: [
        {
          Given: `${REVIEW_IS}${ALL_FIELDS_IN_VIEW}`,
          When: [SHOW_RESULT_SCREEN, WAIT_FOR_DESCRIPTION_COMPLETE, WAIT_FOR_REVIEW_START],
          Then: "「博士からのコメント」の先頭の 1 文字「雷」が表示される",
        },
      ],
    },
    () => {
      renderAnswerReveal();
      advanceToReviewStage();
      advance(CHAR_INTERVAL_MS);
      expect(screen.getByTestId("review-text")).toHaveTextContent("雷");
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: `${REVIEW_IS}${ALL_FIELDS_IN_VIEW}`,
          When: [SHOW_RESULT_SCREEN, WAIT_FOR_DESCRIPTION_COMPLETE, WAIT_FOR_REVIEW_COMPLETE],
          Then: "「博士からのコメント」が「雷の嵐という訳がよくできている。集まるの意味も正しく伝わっている。」と全文表示される",
        },
      ],
    },
    () => {
      renderAnswerReveal();
      advanceToReviewStage();
      advance(CHAR_INTERVAL_MS * REVIEW.length);
      expect(screen.getByTestId("review-text")).toHaveTextContent("雷の嵐という訳がよくできている。集まるの意味も正しく伝わっている。");
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
