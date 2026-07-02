import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ScoreDisplay, SCORE_LABELS } from "./ScoreDisplay";
import type { ScoreResponse } from "../../../../shared/api-types/quest";
import { spec } from "../../test/labels";

/**
 * ScoreDisplay の仕様:
 * - スコアの値域 (0, 1-40, 41-79, 80-99, 100) ごとに表示する "こうか" ラベルが切り替わる
 * - HP 表示は 100 - score
 *
 * 文言は SCORE_LABELS から import する SSOT。`spec()` で testing-library 用に正規化する。
 */
function withScore(score: number): ScoreResponse {
  return { score, review: "", description_ja: "" };
}

describe("ScoreDisplay の仕様", () => {
  it("score=100 のとき 'いちげき ひっさつ' ラベルを出す", () => {
    render(<ScoreDisplay score={withScore(100)} />);
    expect(screen.getByText(spec(SCORE_LABELS.critical))).toBeInTheDocument();
  });

  it("score=80-99 のとき 'ばつぐん' ラベルを出す", () => {
    render(<ScoreDisplay score={withScore(85)} />);
    expect(screen.getByText(spec(SCORE_LABELS.superEffective))).toBeInTheDocument();
  });

  it("score=41-79 のとき 効果ラベルは出さない (通常帯)", () => {
    render(<ScoreDisplay score={withScore(60)} />);
    expect(screen.queryByText(spec(SCORE_LABELS.critical))).not.toBeInTheDocument();
    expect(screen.queryByText(spec(SCORE_LABELS.superEffective))).not.toBeInTheDocument();
    expect(screen.queryByText(spec(SCORE_LABELS.notVeryEffective))).not.toBeInTheDocument();
    expect(screen.queryByText(spec(SCORE_LABELS.noEffect))).not.toBeInTheDocument();
  });

  it("score=1-40 のとき 'いまひとつ' ラベルを出す", () => {
    render(<ScoreDisplay score={withScore(15)} />);
    expect(screen.getByText(spec(SCORE_LABELS.notVeryEffective))).toBeInTheDocument();
  });

  it("score=0 のとき 'こうかなし' ラベルを出す", () => {
    render(<ScoreDisplay score={withScore(0)} />);
    expect(screen.getByText(spec(SCORE_LABELS.noEffect))).toBeInTheDocument();
  });

  it("HP 表示は (100 - score) / 100 になる", () => {
    render(<ScoreDisplay score={withScore(35)} />);
    expect(screen.getByText("65/100")).toBeInTheDocument();
  });
});

describe("スコア帯の境界 (両側を確かめる)", () => {
  it.each([
    { score: 99, label: SCORE_LABELS.superEffective },
    { score: 80, label: SCORE_LABELS.superEffective },
    { score: 40, label: SCORE_LABELS.notVeryEffective },
    { score: 1, label: SCORE_LABELS.notVeryEffective },
  ])("score=$score は該当帯のラベルを出す", ({ score, label }) => {
    render(<ScoreDisplay score={withScore(score)} />);
    expect(screen.getByText(spec(label))).toBeInTheDocument();
  });

  it.each([79, 41])("score=%i は通常帯でラベルを出さない", (score) => {
    render(<ScoreDisplay score={withScore(score)} />);
    expect(screen.queryByText(spec(SCORE_LABELS.critical))).not.toBeInTheDocument();
    expect(screen.queryByText(spec(SCORE_LABELS.superEffective))).not.toBeInTheDocument();
    expect(screen.queryByText(spec(SCORE_LABELS.notVeryEffective))).not.toBeInTheDocument();
    expect(screen.queryByText(spec(SCORE_LABELS.noEffect))).not.toBeInTheDocument();
  });
});
