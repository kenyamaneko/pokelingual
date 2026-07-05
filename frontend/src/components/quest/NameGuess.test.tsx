import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { spec } from "../../test/labels";
import { NameGuess, NAME_GUESS_LABELS } from "./NameGuess";
import type { GuessResponse } from "../../../../shared/api-types/quest";

/**
 * NameGuess の仕様:
 * - guessResult が null のときは入力欄と submit/skip ボタンが描画される
 * - 不正解 + 残りあり → 入力継続可
 * - 不正解 + 残り 0 → 入力欄消失、名前が公開される
 * - 正解 → 入力欄消失、進む系のボタンに切り替わる
 *
 * submit で入力名が渡り判定へ進む・スキップで捕獲へ進む結合は、実際に判定結果や
 * 捕獲画面が出る結果を観測するため QuestPage.test.tsx (公開入口からのフロー) で確かめる。
 */
describe("NameGuess", () => {
  it("guessResult が null のとき入力欄と送信ボタンが描画される", () => {
    render(<NameGuess onSubmit={vi.fn()} onSkip={vi.fn()} guessResult={null} />);

    expect(screen.getByRole("textbox")).toBeEnabled();
    expect(
      screen.getByRole("button", { name: NAME_GUESS_LABELS.submitButton }),
    ).toBeInTheDocument();
  });

  it("空テキストのときは送信ボタンが disabled", () => {
    render(<NameGuess onSubmit={vi.fn()} onSkip={vi.fn()} guessResult={null} />);
    expect(
      screen.getByRole("button", { name: NAME_GUESS_LABELS.submitButton }),
    ).toBeDisabled();
  });

  it("不正解で残り試行があるときは入力欄を維持する", () => {
    const guess: GuessResponse = { correct: false, attempts_remaining: 2 };
    render(<NameGuess onSubmit={vi.fn()} onSkip={vi.fn()} guessResult={guess} />);

    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: NAME_GUESS_LABELS.submitButton }),
    ).toBeInTheDocument();
  });

  it("不正解で残り 2 回は「もう一度」を表示する", () => {
    const guess: GuessResponse = { correct: false, attempts_remaining: 2 };
    render(<NameGuess onSubmit={vi.fn()} onSkip={vi.fn()} guessResult={guess} />);
    expect(screen.getByText(/もう一度/)).toBeInTheDocument();
  });

  it("不正解で残り 1 回は「ラストチャンス」を表示する", () => {
    const guess: GuessResponse = { correct: false, attempts_remaining: 1 };
    render(<NameGuess onSubmit={vi.fn()} onSkip={vi.fn()} guessResult={guess} />);
    expect(screen.getByText(/ラストチャンス/)).toBeInTheDocument();
  });

  it("不正解で残り 0 のとき正解の名前 (en/ja) を表示し、入力欄を消す", () => {
    const guess: GuessResponse = {
      correct: false,
      attempts_remaining: 0,
      reveal_name_en: "Pikachu",
      reveal_name_ja: "ピカチュウ",
    };
    render(<NameGuess onSubmit={vi.fn()} onSkip={vi.fn()} guessResult={guess} />);

    expect(screen.getByText(spec(NAME_GUESS_LABELS.wrongFinalTitle))).toBeInTheDocument();
    expect(screen.getByText(/Pikachu/)).toBeInTheDocument();
    expect(screen.getByText(/ピカチュウ/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("正解のとき入力欄を消し、進むボタンに切り替える", () => {
    const guess: GuessResponse = {
      correct: true,
      ball_type: "ultra",
      language: "en",
      attempts_remaining: 2,
    };
    render(<NameGuess onSubmit={vi.fn()} onSkip={vi.fn()} guessResult={guess} />);

    expect(screen.getByText(spec(NAME_GUESS_LABELS.correctTitle))).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: NAME_GUESS_LABELS.proceedButton }),
    ).toBeInTheDocument();
  });
});
