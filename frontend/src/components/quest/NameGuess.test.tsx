import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { spec } from "../../test/labels";
import { NameGuess, NAME_GUESS_LABELS } from "./NameGuess";
import { POKEMON_NAME_INPUT_LABELS } from "./PokemonNameInput";
import type { GuessResponse, HintResponse } from "../../../../shared/api-types/quest";

/**
 * NameGuess の仕様:
 * - guessResult が null のときは入力欄と submit/skip ボタンが描画される
 * - 不正解 + 残りあり → 入力継続可
 * - 不正解 + 残り 0 → 入力欄消失、名前が公開される
 * - 正解 → 入力欄消失、進む系のボタンに切り替わる
 *
 * submit で入力名が渡り判定へ進む結合、下部ボタン (skip/proceed) を押した先で捕獲フェーズの
 * 正しいボールが出る結果は、実際に画面が切り替わる結果として観測するため QuestPage.test.tsx
 * (公開入口からのフロー) で確かめる。
 */
describe("[クエスト] 名前当ての入力と結果表示", () => {
  it("まだ名前当てに答えていないとき、入力欄と送信ボタンが表示される", () => {
    render(
      <NameGuess
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
        onProceed={vi.fn()}
        guessResult={null}
        attemptsRemaining={3}
        maxGuessAttempts={3}
        hintResult={null}
      />,
    );

    expect(screen.getByRole("textbox")).toBeEnabled();
    expect(
      screen.getByRole("button", { name: POKEMON_NAME_INPUT_LABELS.submitButton }),
    ).toBeInTheDocument();
  });

  it("空テキストのときは送信ボタンが押せない", () => {
    render(
      <NameGuess
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
        onProceed={vi.fn()}
        guessResult={null}
        attemptsRemaining={3}
        maxGuessAttempts={3}
        hintResult={null}
      />,
    );
    expect(
      screen.getByRole("button", { name: POKEMON_NAME_INPUT_LABELS.submitButton }),
    ).toBeDisabled();
  });

  it("不正解で残り試行があるときは入力欄を維持する", () => {
    const guess: GuessResponse = { correct: false, attempts_remaining: 2 };
    render(
      <NameGuess
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
        onProceed={vi.fn()}
        guessResult={guess}
        attemptsRemaining={2}
        maxGuessAttempts={3}
        hintResult={null}
      />,
    );

    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: POKEMON_NAME_INPUT_LABELS.submitButton }),
    ).toBeInTheDocument();
  });

  it("不正解で残り 2 回は「もう一度」を表示する", () => {
    const guess: GuessResponse = { correct: false, attempts_remaining: 2 };
    render(
      <NameGuess
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
        onProceed={vi.fn()}
        guessResult={guess}
        attemptsRemaining={2}
        maxGuessAttempts={3}
        hintResult={null}
      />,
    );
    expect(screen.getByText(/もう一度/)).toBeInTheDocument();
  });

  it("不正解で残り 1 回は「ラストチャンス」を表示する", () => {
    const guess: GuessResponse = { correct: false, attempts_remaining: 1 };
    render(
      <NameGuess
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
        onProceed={vi.fn()}
        guessResult={guess}
        attemptsRemaining={1}
        maxGuessAttempts={3}
        hintResult={null}
      />,
    );
    expect(screen.getByText(/ラストチャンス/)).toBeInTheDocument();
  });

  it("不正解で残り 0 のとき正解の名前 (英語と日本語) を表示し、入力欄を消す", () => {
    const guess: GuessResponse = {
      correct: false,
      attempts_remaining: 0,
      reveal_name_en: "Pikachu",
      reveal_name_ja: "ピカチュウ",
    };
    render(
      <NameGuess
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
        onProceed={vi.fn()}
        guessResult={guess}
        attemptsRemaining={0}
        maxGuessAttempts={3}
        hintResult={null}
      />,
    );

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
    render(
      <NameGuess
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
        onProceed={vi.fn()}
        guessResult={guess}
        attemptsRemaining={2}
        maxGuessAttempts={3}
        hintResult={null}
      />,
    );

    expect(screen.getByText(spec(NAME_GUESS_LABELS.correctTitle))).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: NAME_GUESS_LABELS.proceedButton }),
    ).toBeInTheDocument();
  });

  it("マスターボールが確定して正解のとき、正解メッセージにマスターボールが表示される", () => {
    const guess: GuessResponse = {
      correct: true,
      ball_type: "master",
      language: "en",
      attempts_remaining: 2,
    };
    render(
      <NameGuess
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
        onProceed={vi.fn()}
        guessResult={guess}
        attemptsRemaining={2}
        maxGuessAttempts={3}
        hintResult={null}
      />,
    );

    expect(screen.getByText(/マスターボール/)).toBeInTheDocument();
  });
});

describe("[クエスト] 残り挑戦回数の表示", () => {
  it("残り挑戦回数が未確定のとき、残り挑戦回数の表示は出ない", () => {
    render(
      <NameGuess
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
        onProceed={vi.fn()}
        guessResult={null}
        attemptsRemaining={null}
        maxGuessAttempts={null}
        hintResult={null}
      />,
    );
    expect(screen.queryByRole("meter", { name: "残り挑戦回数" })).not.toBeInTheDocument();
  });

  it("最大 3 回中、残り 2 回のとき、残り挑戦回数の表示は現在値 2・最大値 3 になる", () => {
    const guess: GuessResponse = { correct: false, attempts_remaining: 2 };
    render(
      <NameGuess
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
        onProceed={vi.fn()}
        guessResult={guess}
        attemptsRemaining={2}
        maxGuessAttempts={3}
        hintResult={null}
      />,
    );
    const meter = screen.getByRole("meter", { name: "残り挑戦回数" });
    expect(meter).toHaveAttribute("aria-valuenow", "2");
    expect(meter).toHaveAttribute("aria-valuemax", "3");
  });
});

describe("[クエスト] 名前当てのヒント表示", () => {
  it("ヒント要求の受け口が渡されていないとき、ヒントボタンは表示されない", () => {
    render(
      <NameGuess
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
        onProceed={vi.fn()}
        guessResult={null}
        attemptsRemaining={3}
        maxGuessAttempts={3}
        hintResult={null}
      />,
    );
    expect(screen.queryByRole("button", { name: NAME_GUESS_LABELS.hintButton })).not.toBeInTheDocument();
  });

  it("残り試行回数が未確定 (未回答) のとき、ヒントボタンが表示される", () => {
    render(
      <NameGuess
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
        onProceed={vi.fn()}
        guessResult={null}
        attemptsRemaining={null}
        maxGuessAttempts={null}
        hintResult={null}
        onHint={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: NAME_GUESS_LABELS.hintButton })).toBeInTheDocument();
  });

  it("残り試行回数が 2 回のとき、ヒントボタンが表示される", () => {
    const guess: GuessResponse = { correct: false, attempts_remaining: 2 };
    render(
      <NameGuess
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
        onProceed={vi.fn()}
        guessResult={guess}
        attemptsRemaining={2}
        maxGuessAttempts={3}
        hintResult={null}
        onHint={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: NAME_GUESS_LABELS.hintButton })).toBeInTheDocument();
  });

  it("残り試行回数が 1 回のとき、ヒントボタンは表示されず、ヒントが使えない旨を案内する", () => {
    const guess: GuessResponse = { correct: false, attempts_remaining: 1 };
    render(
      <NameGuess
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
        onProceed={vi.fn()}
        guessResult={guess}
        attemptsRemaining={1}
        maxGuessAttempts={3}
        hintResult={null}
        onHint={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: NAME_GUESS_LABELS.hintButton })).not.toBeInTheDocument();
    expect(screen.getByText(NAME_GUESS_LABELS.hintUnavailable)).toBeInTheDocument();
  });

  it("1回目のヒント (タイプ) を取得済みで、残り試行回数が2回のとき、2回目のヒントボタンが表示される", () => {
    const hint: HintResponse = { types: ["electric"], attempts_remaining: 2 };
    render(
      <NameGuess
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
        onProceed={vi.fn()}
        guessResult={null}
        attemptsRemaining={2}
        maxGuessAttempts={3}
        hintResult={hint}
        onHint={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: NAME_GUESS_LABELS.hintButton })).toBeInTheDocument();
  });

  it("1回目のヒント (タイプ) を取得済みで、残り試行回数が1回のとき、ヒントボタンは表示されず、ヒントが使えない旨を案内する", () => {
    const hint: HintResponse = { types: ["electric"], attempts_remaining: 1 };
    render(
      <NameGuess
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
        onProceed={vi.fn()}
        guessResult={null}
        attemptsRemaining={1}
        maxGuessAttempts={3}
        hintResult={hint}
        onHint={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: NAME_GUESS_LABELS.hintButton })).not.toBeInTheDocument();
    expect(screen.getByText(NAME_GUESS_LABELS.hintUnavailable)).toBeInTheDocument();
  });

  it("2回とも (タイプ・技) ヒントを取得済みのとき、ヒントボタンは表示されず、ヒントが使えない旨の案内も出ない", () => {
    const hint: HintResponse = { types: ["electric"], moves: ["でんきショック"], attempts_remaining: 1 };
    render(
      <NameGuess
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
        onProceed={vi.fn()}
        guessResult={null}
        attemptsRemaining={1}
        maxGuessAttempts={3}
        hintResult={hint}
        onHint={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: NAME_GUESS_LABELS.hintButton })).not.toBeInTheDocument();
    expect(screen.queryByText(NAME_GUESS_LABELS.hintUnavailable)).not.toBeInTheDocument();
  });

  it("名前当てが完了済みのとき、ヒントボタンは表示されない", () => {
    const guess: GuessResponse = { correct: true, ball_type: "ultra", language: "en", attempts_remaining: 2 };
    render(
      <NameGuess
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
        onProceed={vi.fn()}
        guessResult={guess}
        attemptsRemaining={2}
        maxGuessAttempts={3}
        hintResult={null}
        onHint={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: NAME_GUESS_LABELS.hintButton })).not.toBeInTheDocument();
  });

  it("ヒントボタンを押すと、ヒント要求が呼ばれる", async () => {
    const user = userEvent.setup();
    const onHint = vi.fn().mockResolvedValue(undefined);
    render(
      <NameGuess
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
        onProceed={vi.fn()}
        guessResult={null}
        attemptsRemaining={3}
        maxGuessAttempts={3}
        hintResult={null}
        onHint={onHint}
      />,
    );
    await user.click(screen.getByRole("button", { name: NAME_GUESS_LABELS.hintButton }));
    expect(onHint).toHaveBeenCalledTimes(1);
  });

  it("ヒント要求が完了する前にボタンを連打しても、ヒント要求は1回しか呼ばれない", async () => {
    let resolveHint: () => void = () => {};
    const onHint = vi.fn(() => new Promise<void>((resolve) => { resolveHint = resolve; }));
    render(
      <NameGuess
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
        onProceed={vi.fn()}
        guessResult={null}
        attemptsRemaining={3}
        maxGuessAttempts={3}
        hintResult={null}
        onHint={onHint}
      />,
    );
    const button = screen.getByRole("button", { name: NAME_GUESS_LABELS.hintButton });

    // userEvent は各操作の間で状態更新を待つため、同一tick内の連打を再現できない
    await act(async () => {
      button.click();
      button.click();
    });

    expect(onHint).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();

    await act(async () => {
      resolveHint();
    });
  });

  it("1回目のヒント (タイプ) 取得後にヒントボタンを押すと、2回目のヒント要求が呼ばれる", async () => {
    const user = userEvent.setup();
    const onHint = vi.fn().mockResolvedValue(undefined);
    const hint: HintResponse = { types: ["electric"], attempts_remaining: 2 };
    render(
      <NameGuess
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
        onProceed={vi.fn()}
        guessResult={null}
        attemptsRemaining={2}
        maxGuessAttempts={3}
        hintResult={hint}
        onHint={onHint}
      />,
    );
    await user.click(screen.getByRole("button", { name: NAME_GUESS_LABELS.hintButton }));
    expect(onHint).toHaveBeenCalledTimes(1);
  });

  it("ヒント取得後は、単一タイプなら「〜タイプのポケモンだよ」と表示される", () => {
    const hint: HintResponse = { types: ["electric"], attempts_remaining: 2 };
    render(
      <NameGuess
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
        onProceed={vi.fn()}
        guessResult={null}
        attemptsRemaining={2}
        maxGuessAttempts={3}
        hintResult={hint}
        onHint={vi.fn()}
      />,
    );
    expect(screen.getByText("でんきタイプのポケモンだよ")).toBeInTheDocument();
  });

  it("ヒント取得後は、複合タイプなら「〜・〜タイプのポケモンだよ」と表示される", () => {
    const hint: HintResponse = { types: ["grass", "poison"], attempts_remaining: 2 };
    render(
      <NameGuess
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
        onProceed={vi.fn()}
        guessResult={null}
        attemptsRemaining={2}
        maxGuessAttempts={3}
        hintResult={hint}
        onHint={vi.fn()}
      />,
    );
    expect(screen.getByText("くさ・どくタイプのポケモンだよ")).toBeInTheDocument();
  });

  it("2回目のヒント取得後は、技の一覧が表示される", () => {
    const hint: HintResponse = {
      types: ["electric"],
      moves: ["たいあたり", "なきごえ", "でんきショック"],
      attempts_remaining: 1,
    };
    render(
      <NameGuess
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
        onProceed={vi.fn()}
        guessResult={null}
        attemptsRemaining={1}
        maxGuessAttempts={3}
        hintResult={hint}
        onHint={vi.fn()}
      />,
    );
    expect(screen.getByText("「たいあたり」「なきごえ」「でんきショック」を覚えるよ")).toBeInTheDocument();
  });

  it("技が1件だけのときも、その1件が表示される", () => {
    const hint: HintResponse = { types: ["electric"], moves: ["でんきショック"], attempts_remaining: 1 };
    render(
      <NameGuess
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
        onProceed={vi.fn()}
        guessResult={null}
        attemptsRemaining={1}
        maxGuessAttempts={3}
        hintResult={hint}
        onHint={vi.fn()}
      />,
    );
    expect(screen.getByText("「でんきショック」を覚えるよ")).toBeInTheDocument();
  });

  it("技が0件のときは、覚える技が無い旨が表示される", () => {
    const hint: HintResponse = { types: ["electric"], moves: [], attempts_remaining: 1 };
    render(
      <NameGuess
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
        onProceed={vi.fn()}
        guessResult={null}
        attemptsRemaining={1}
        maxGuessAttempts={3}
        hintResult={hint}
        onHint={vi.fn()}
      />,
    );
    expect(screen.getByText(NAME_GUESS_LABELS.movesUnavailable)).toBeInTheDocument();
  });

  it("2回目のヒント取得後も、1回目のタイプの表示は消えない", () => {
    const hint: HintResponse = { types: ["electric"], moves: ["でんきショック"], attempts_remaining: 1 };
    render(
      <NameGuess
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
        onProceed={vi.fn()}
        guessResult={null}
        attemptsRemaining={1}
        maxGuessAttempts={3}
        hintResult={hint}
        onHint={vi.fn()}
      />,
    );
    expect(screen.getByText("でんきタイプのポケモンだよ")).toBeInTheDocument();
  });
});
