import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { spec } from "../../test/labels";
import { NameGuess, NAME_GUESS_LABELS } from "./NameGuess";
import type { GuessResponse } from "../../../../shared/api-types/quest";

/**
 * NameGuess の仕様:
 * - guessResult が null のときは編集可、submit/skip ボタンが押せる
 * - submit で onSubmit に入力値が渡る
 * - 不正解 + 残りあり → 入力継続可
 * - 不正解 + 残り 0 → 入力欄消失、名前が公開される
 * - 正解 → 入力欄消失、進む系のボタンに切り替わる
 * - 進む/スキップボタンで onSkip が呼ばれる
 */
describe("NameGuess の仕様", () => {
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

  it("入力して送信すると onSubmit に入力値が渡る", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<NameGuess onSubmit={onSubmit} onSkip={vi.fn()} guessResult={null} />);

    await user.type(screen.getByRole("textbox"), "Pikachu");
    await user.click(
      screen.getByRole("button", { name: NAME_GUESS_LABELS.submitButton }),
    );

    expect(onSubmit).toHaveBeenCalledWith("Pikachu");
  });

  it("不正解で残り試行があるときは入力欄を維持する", () => {
    const guess: GuessResponse = { correct: false, attempts_remaining: 2 };
    render(<NameGuess onSubmit={vi.fn()} onSkip={vi.fn()} guessResult={guess} />);

    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: NAME_GUESS_LABELS.submitButton }),
    ).toBeInTheDocument();
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

  it("スキップ/進むボタン押下で onSkip が呼ばれる", async () => {
    const user = userEvent.setup();
    const onSkip = vi.fn();
    render(<NameGuess onSubmit={vi.fn()} onSkip={onSkip} guessResult={null} />);

    await user.click(
      screen.getByRole("button", { name: NAME_GUESS_LABELS.skipButton }),
    );

    expect(onSkip).toHaveBeenCalledOnce();
  });
});
