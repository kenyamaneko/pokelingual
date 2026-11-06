import { render, screen, act } from "@testing-library/react";
import { describe, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ScoreDisplay,
  METER_ANIMATION_DURATION_MS,
  DAMAGE_REVEAL_DELAY_MS,
} from "./ScoreDisplay";
import type { ScoreResponse } from "../../../../shared/api-types/quest";
import { spec } from "../../test/labels";
import { defineCase } from "../../test/defineCase";

function withScore(score: number): ScoreResponse {
  return { score, review: "", description_ja: "" };
}

function renderScoreDisplayAfter(score: number, elapsedMs: number) {
  render(<ScoreDisplay score={withScore(score)} isActive={true} />);
  act(() => {
    vi.advanceTimersByTime(elapsedMs);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const DISPLAY_SCORE = "採点スコアの演出を始める";
const WAIT_UNTIL_HP_DECREASE_ENDS = "HP の減少が終わるまで待つ";
const WAIT_UNTIL_HP_BAR_SHOWS_85 = "HP バーが 85% を示すまで待つ";
const WAIT_UNTIL_HP_NUMBER_SHOWS_85 = "HP の数値が 85% と表示されるまで待つ";
const WAIT_UNTIL_HP_BAR_SHOWS_49 = "HP バーが 49% を示すまで待つ";
const WAIT_UNTIL_HP_NUMBER_SHOWS_49 = "HP の数値が 49% と表示されるまで待つ";
const WAIT_UNTIL_DAMAGE_REVEAL = "ダメージ数値が出るまで待つ";
const WAIT_UNTIL_EFFECT_REVEAL = "こうか表示が出るまで待つ";

type HpBandRow = {
  score: number;
  operations: readonly [string, ...string[]];
  elapsedRatio: number;
  remainingHp: number;
};

describe("[本体:採点]採点スコアの演出", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ When: [DISPLAY_SCORE], Then: "HP の減少が始まった直後は、HP バーが 100% を示す" }],
    },
    () => {
      renderScoreDisplayAfter(30, 0);
      expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "100");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ When: [DISPLAY_SCORE], Then: "HP の減少が始まった直後は、HP の数値が 100% と表示される" }],
    },
    () => {
      renderScoreDisplayAfter(30, 0);
      expect(screen.getByText("100%")).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: "スコアが 30 のとき", When: [DISPLAY_SCORE, WAIT_UNTIL_HP_NUMBER_SHOWS_85], Then: "HP バーが 85% を示す" }],
    },
    () => {
      renderScoreDisplayAfter(30, METER_ANIMATION_DURATION_MS / 2);
      expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "85");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: "スコアが 30 のとき", When: [DISPLAY_SCORE, WAIT_UNTIL_HP_BAR_SHOWS_85], Then: "HP の数値が 85% と表示される" }],
    },
    () => {
      renderScoreDisplayAfter(30, METER_ANIMATION_DURATION_MS / 2);
      expect(screen.getByText("85%")).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: "スコアが 30 のとき", When: [DISPLAY_SCORE, WAIT_UNTIL_HP_DECREASE_ENDS], Then: "HP バーが 70% を示す" }],
    },
    () => {
      renderScoreDisplayAfter(30, METER_ANIMATION_DURATION_MS);
      expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "70");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: "スコアが 30 のとき", When: [DISPLAY_SCORE, WAIT_UNTIL_HP_DECREASE_ENDS], Then: "HP の数値が 70% と表示される" }],
    },
    () => {
      renderScoreDisplayAfter(30, METER_ANIMATION_DURATION_MS);
      expect(screen.getByText("70%")).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: "スコアが 30 のとき", When: [DISPLAY_SCORE, WAIT_UNTIL_HP_DECREASE_ENDS], Then: "ダメージ数値がまだ表示されていない" }],
    },
    () => {
      renderScoreDisplayAfter(30, METER_ANIMATION_DURATION_MS);
      expect(screen.queryByTestId("damage-value")).not.toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: "スコアが 30 のとき", When: [DISPLAY_SCORE, WAIT_UNTIL_HP_DECREASE_ENDS], Then: "こうか表示「効果は　いまひとつのようだ」がまだ表示されていない" }],
    },
    () => {
      renderScoreDisplayAfter(30, METER_ANIMATION_DURATION_MS);
      expect(screen.queryByText(spec("効果は　いまひとつのようだ"))).not.toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: "スコアが 30 のとき", When: [DISPLAY_SCORE, WAIT_UNTIL_EFFECT_REVEAL], Then: "ダメージ数値が 30% と表示される" }],
    },
    () => {
      renderScoreDisplayAfter(30, METER_ANIMATION_DURATION_MS + DAMAGE_REVEAL_DELAY_MS);
      expect(screen.getByText("30%")).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: "スコアが 30 のとき", When: [DISPLAY_SCORE, WAIT_UNTIL_DAMAGE_REVEAL], Then: "こうか表示「効果は　いまひとつのようだ」が表示される" }],
    },
    () => {
      renderScoreDisplayAfter(30, METER_ANIMATION_DURATION_MS + DAMAGE_REVEAL_DELAY_MS);
      expect(screen.getByText(spec("効果は　いまひとつのようだ"))).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: "スコアが 85 のとき", When: [DISPLAY_SCORE, WAIT_UNTIL_HP_NUMBER_SHOWS_49], Then: "HP バーが 49% を示す" }],
    },
    () => {
      renderScoreDisplayAfter(85, METER_ANIMATION_DURATION_MS * 0.6);
      expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "49");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: "スコアが 85 のとき", When: [DISPLAY_SCORE, WAIT_UNTIL_HP_DECREASE_ENDS], Then: "HP バーが 15% を示す" }],
    },
    () => {
      renderScoreDisplayAfter(85, METER_ANIMATION_DURATION_MS);
      expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "15");
    },
  );

  for (const { score, operations, elapsedRatio, remainingHp } of [
    { score: 85, operations: [DISPLAY_SCORE], elapsedRatio: 0, remainingHp: 100 },
    { score: 49, operations: [DISPLAY_SCORE, WAIT_UNTIL_HP_DECREASE_ENDS], elapsedRatio: 1, remainingHp: 51 },
  ] satisfies HpBandRow[]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        steps: [{ Given: `スコアが ${score} のとき`, When: operations, Then: `残り HP が ${remainingHp}% で、HP バーの色は緑になる` }],
      },
      () => {
        renderScoreDisplayAfter(score, METER_ANIMATION_DURATION_MS * elapsedRatio);
        expect(screen.getByTestId("hp-bar")).toHaveAttribute("data-hp-band", "green");
      },
    );
  }

  for (const { score, operations, elapsedRatio, remainingHp } of [
    { score: 85, operations: [DISPLAY_SCORE, WAIT_UNTIL_HP_BAR_SHOWS_49], elapsedRatio: 0.6, remainingHp: 49 },
    { score: 50, operations: [DISPLAY_SCORE, WAIT_UNTIL_HP_DECREASE_ENDS], elapsedRatio: 1, remainingHp: 50 },
    { score: 79, operations: [DISPLAY_SCORE, WAIT_UNTIL_HP_DECREASE_ENDS], elapsedRatio: 1, remainingHp: 21 },
  ] satisfies HpBandRow[]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        steps: [{ Given: `スコアが ${score} のとき`, When: operations, Then: `残り HP が ${remainingHp}% で、HP バーの色は黄になる` }],
      },
      () => {
        renderScoreDisplayAfter(score, METER_ANIMATION_DURATION_MS * elapsedRatio);
        expect(screen.getByTestId("hp-bar")).toHaveAttribute("data-hp-band", "yellow");
      },
    );
  }

  for (const { score, operations, elapsedRatio, remainingHp } of [
    { score: 85, operations: [DISPLAY_SCORE, WAIT_UNTIL_HP_DECREASE_ENDS], elapsedRatio: 1, remainingHp: 15 },
    { score: 80, operations: [DISPLAY_SCORE, WAIT_UNTIL_HP_DECREASE_ENDS], elapsedRatio: 1, remainingHp: 20 },
  ] satisfies HpBandRow[]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        steps: [{ Given: `スコアが ${score} のとき`, When: operations, Then: `残り HP が ${remainingHp}% で、HP バーの色は赤になる` }],
      },
      () => {
        renderScoreDisplayAfter(score, METER_ANIMATION_DURATION_MS * elapsedRatio);
        expect(screen.getByTestId("hp-bar")).toHaveAttribute("data-hp-band", "red");
      },
    );
  }
});
