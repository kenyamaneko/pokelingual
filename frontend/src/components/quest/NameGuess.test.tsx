import type { ComponentProps } from "react";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { spec } from "../../test/labels";
import { NameGuess } from "./NameGuess";
import type { GuessResponse, HintResponse } from "../../../../shared/api-types/quest";

type NameGuessProps = ComponentProps<typeof NameGuess>;

const HINT_BUTTON = "ヒントを見る（チャンスを1回使う）";
const HINT_BUTTON_AGAIN = "別のヒントを見る（チャンスを1回使う）";
const SUBMIT_BUTTON = "君に　決めた！";
const PROCEED_BUTTON = "次へ進む";
const HINT_UNAVAILABLE = "もうヒントは使えないよ";

function renderNameGuess(overrides: Partial<NameGuessProps> = {}) {
  render(
    <NameGuess
      onSubmit={vi.fn()}
      onSkip={vi.fn()}
      onProceed={vi.fn()}
      guessResult={null}
      attemptsRemaining={3}
      maxGuessAttempts={3}
      hintResult={null}
      {...overrides}
    />,
  );
}

const WRONG_GUESS_2_LEFT: GuessResponse = { correct: false, attempts_remaining: 2 };
const WRONG_GUESS_1_LEFT: GuessResponse = { correct: false, attempts_remaining: 1 };
const CORRECT_GUESS: GuessResponse = {
  correct: true,
  ball_type: "ultra",
  language: "en",
  attempts_remaining: 2,
};
const TYPE_HINT_2_LEFT: HintResponse = { types: ["electric"], attempts_remaining: 2 };
const TYPE_HINT_1_LEFT: HintResponse = { types: ["electric"], attempts_remaining: 1 };
const TYPE_AND_MOVE_HINT: HintResponse = {
  types: ["electric"],
  moves: ["でんきショック"],
  attempts_remaining: 1,
};

describe("[本体:名前当て]名前当ての入力と結果表示", () => {
  describe("まだ名前当てに答えていないとき", () => {
    describe("部品間結合テスト", () => {
      describe("正常系", () => {
        it("入力欄が入力できる状態で表示される", () => {
          renderNameGuess();
          expect(screen.getByRole("textbox")).toBeEnabled();
        });
      });

      describe("異常系", () => {
        it("入力欄が空のとき、「君に　決めた！」ボタンは押せない状態になる", () => {
          renderNameGuess();
          expect(screen.getByRole("button", { name: SUBMIT_BUTTON })).toBeDisabled();
        });
      });
    });
  });

  describe("不正解で残り挑戦回数が 2 回のとき", () => {
    describe("部品間結合テスト", () => {
      describe("正常系", () => {
        it("入力欄が表示される", () => {
          renderNameGuess({ guessResult: WRONG_GUESS_2_LEFT, attemptsRemaining: 2 });
          expect(screen.getByRole("textbox")).toBeInTheDocument();
        });

        it("「もう一度」を含むメッセージ (「はずれ…　もう一度やってみよう！」) が表示される", () => {
          renderNameGuess({ guessResult: WRONG_GUESS_2_LEFT, attemptsRemaining: 2 });
          expect(screen.getByText(spec("はずれ…　もう一度やってみよう！"))).toBeInTheDocument();
        });
      });
    });
  });

  describe("部品間結合テスト", () => {
    describe("正常系", () => {
      it.each<[string, Partial<NameGuessProps>]>([
        ["まだ名前当てに答えていないとき", {}],
        [
          "不正解で残り挑戦回数が 2 回のとき",
          { guessResult: WRONG_GUESS_2_LEFT, attemptsRemaining: 2 },
        ],
      ])("%s、「君に　決めた！」ボタンが表示される", (_given, props) => {
        renderNameGuess(props);
        expect(screen.getByRole("button", { name: SUBMIT_BUTTON })).toBeInTheDocument();
      });

      it.each<[string, Partial<NameGuessProps>]>([
        [
          "不正解で残り挑戦回数が 0 回になったとき",
          { guessResult: { correct: false, attempts_remaining: 0 }, attemptsRemaining: 0 },
        ],
        ["名前当てに正解したとき", { guessResult: CORRECT_GUESS, attemptsRemaining: 2 }],
      ])("%s、入力欄が表示されなくなる", (_given, props) => {
        renderNameGuess(props);
        expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      });

      it("不正解で残り挑戦回数が 1 回のとき、「ラストチャンス」を含むメッセージ (「はずれ…　ラストチャンス！」) が表示される", () => {
        renderNameGuess({ guessResult: WRONG_GUESS_1_LEFT, attemptsRemaining: 1 });
        expect(screen.getByText(spec("はずれ…　ラストチャンス！"))).toBeInTheDocument();
      });
    });
  });

  describe("不正解で残り挑戦回数が 0 回になったとき", () => {
    const guess: GuessResponse = { correct: false, attempts_remaining: 0 };

    describe("部品間結合テスト", () => {
      describe("正常系", () => {
        it("「残念...」と表示される", () => {
          renderNameGuess({ guessResult: guess, attemptsRemaining: 0 });
          expect(screen.getByText(spec("残念..."))).toBeInTheDocument();
        });
      });
    });
  });

  describe("名前当てに正解したとき", () => {
    describe("部品間結合テスト", () => {
      describe("正常系", () => {
        it("「正解！」と表示される", () => {
          renderNameGuess({ guessResult: CORRECT_GUESS, attemptsRemaining: 2 });
          expect(screen.getByText(spec("正解！"))).toBeInTheDocument();
        });

        it("「次へ進む」ボタンが表示される", () => {
          renderNameGuess({ guessResult: CORRECT_GUESS, attemptsRemaining: 2 });
          expect(screen.getByRole("button", { name: PROCEED_BUTTON })).toBeInTheDocument();
        });
      });
    });
  });
});

describe("[本体:名前当て]残り挑戦回数の表示", () => {
  describe("部品間結合テスト", () => {
    describe("正常系", () => {
      it("残り挑戦回数がまだ分からないとき、残り挑戦回数の表示が出ない", () => {
        renderNameGuess({ attemptsRemaining: null, maxGuessAttempts: null });
        expect(screen.queryByRole("meter", { name: "残り挑戦回数" })).not.toBeInTheDocument();
      });

      it("最大挑戦回数が 3 回で残り挑戦回数が 2 回のとき、残り挑戦回数の表示が 3 回中 2 回を示す", () => {
        renderNameGuess({ guessResult: WRONG_GUESS_2_LEFT, attemptsRemaining: 2, maxGuessAttempts: 3 });
        const meter = screen.getByRole("meter", { name: "残り挑戦回数" });
        expect(meter).toHaveAttribute("aria-valuenow", "2");
        expect(meter).toHaveAttribute("aria-valuemax", "3");
      });
    });
  });
});

describe("[本体:名前当て]名前当てのヒント表示", () => {
  describe("部品間結合テスト", () => {
    describe("正常系", () => {
      it.each<[string, Partial<NameGuessProps>]>([
        ["チュートリアルの名前当て画面のとき", {}],
        [
          "名前当てに正解したとき",
          { guessResult: CORRECT_GUESS, attemptsRemaining: 2, onHint: vi.fn() },
        ],
        [
          "ヒントをまだ使っておらず、残り挑戦回数が 1 回のとき",
          { guessResult: WRONG_GUESS_1_LEFT, attemptsRemaining: 1, onHint: vi.fn() },
        ],
      ])("%s、「ヒントを見る（チャンスを1回使う）」ボタンが表示されない", (_given, props) => {
        renderNameGuess(props);
        expect(screen.queryByRole("button", { name: HINT_BUTTON })).not.toBeInTheDocument();
      });

      it.each<[string, Partial<NameGuessProps>]>([
        [
          "まだ名前当てに答えておらず、残り挑戦回数がまだ分からないとき",
          { attemptsRemaining: null, maxGuessAttempts: null, onHint: vi.fn() },
        ],
        [
          "不正解で残り挑戦回数が 2 回のとき",
          { guessResult: WRONG_GUESS_2_LEFT, attemptsRemaining: 2, onHint: vi.fn() },
        ],
      ])("%s、「ヒントを見る（チャンスを1回使う）」ボタンが表示される", (_given, props) => {
        renderNameGuess(props);
        expect(screen.getByRole("button", { name: HINT_BUTTON })).toBeInTheDocument();
      });

      it("タイプのヒントを取得済みで、残り挑戦回数が 2 回のとき、「別のヒントを見る（チャンスを1回使う）」ボタンが表示される", () => {
        renderNameGuess({ attemptsRemaining: 2, hintResult: TYPE_HINT_2_LEFT, onHint: vi.fn() });
        expect(screen.getByRole("button", { name: HINT_BUTTON_AGAIN })).toBeInTheDocument();
      });
    });
  });

  describe("残り挑戦回数が 1 回のとき", () => {
    describe("部品間結合テスト", () => {
      describe("正常系", () => {
        it.each<[string, Partial<NameGuessProps>]>([
          [
            "タイプのヒントを取得済みのとき",
            { attemptsRemaining: 1, hintResult: TYPE_HINT_1_LEFT, onHint: vi.fn() },
          ],
          [
            "タイプと技の両方のヒントを取得済みのとき",
            { attemptsRemaining: 1, hintResult: TYPE_AND_MOVE_HINT, onHint: vi.fn() },
          ],
        ])("%s、「別のヒントを見る（チャンスを1回使う）」ボタンが表示されない", (_given, props) => {
          renderNameGuess(props);
          expect(screen.queryByRole("button", { name: HINT_BUTTON_AGAIN })).not.toBeInTheDocument();
        });

        it.each<[string, Partial<NameGuessProps>]>([
          [
            "ヒントをまだ使っていないとき",
            { guessResult: WRONG_GUESS_1_LEFT, attemptsRemaining: 1, onHint: vi.fn() },
          ],
          [
            "タイプのヒントを取得済みのとき",
            { attemptsRemaining: 1, hintResult: TYPE_HINT_1_LEFT, onHint: vi.fn() },
          ],
        ])("%s、「もうヒントは使えないよ」と表示される", (_given, props) => {
          renderNameGuess(props);
          expect(screen.getByText(HINT_UNAVAILABLE)).toBeInTheDocument();
        });

        it("タイプと技の両方のヒントを取得済みのとき、「もうヒントは使えないよ」と表示されない", () => {
          renderNameGuess({ attemptsRemaining: 1, hintResult: TYPE_AND_MOVE_HINT, onHint: vi.fn() });
          expect(screen.queryByText(HINT_UNAVAILABLE)).not.toBeInTheDocument();
        });
      });
    });
  });

  describe("タイプ「でんき」を含むヒントを取得済みのとき", () => {
    describe("部品間結合テスト", () => {
      describe("正常系", () => {
        it.each<[string, Partial<NameGuessProps>]>([
          [
            "ヒントがタイプ「でんき」だけのとき",
            { attemptsRemaining: 2, hintResult: TYPE_HINT_2_LEFT },
          ],
          [
            "ヒントがタイプ「でんき」と覚える技「でんきショック」のとき",
            { attemptsRemaining: 1, hintResult: TYPE_AND_MOVE_HINT },
          ],
        ])("%s、「でんきタイプのポケモンだよ」と表示される", async (_given, props) => {
          renderNameGuess({ ...props, onHint: vi.fn() });
          expect(await screen.findByText("でんきタイプのポケモンだよ")).toBeInTheDocument();
        });
      });
    });
  });

  describe("タイプのヒントを取得済みのとき", () => {
    describe("部品間結合テスト", () => {
      describe("正常系", () => {
        it("タイプがくさとどくの複合なら、「くさ・どくタイプのポケモンだよ」と表示される", async () => {
          const hint: HintResponse = { types: ["grass", "poison"], attempts_remaining: 2 };
          renderNameGuess({ attemptsRemaining: 2, hintResult: hint, onHint: vi.fn() });
          expect(await screen.findByText("くさ・どくタイプのポケモンだよ")).toBeInTheDocument();
        });
      });
    });
  });

  describe("技のヒントを取得済みのとき", () => {
    describe("部品間結合テスト", () => {
      describe("正常系", () => {
        it("覚える技がたいあたり・なきごえ・でんきショックの 3 件なら、「「たいあたり」「なきごえ」「でんきショック」を覚えるよ」と表示される", async () => {
          const hint: HintResponse = {
            types: ["electric"],
            moves: ["たいあたり", "なきごえ", "でんきショック"],
            attempts_remaining: 1,
          };
          renderNameGuess({ attemptsRemaining: 1, hintResult: hint, onHint: vi.fn() });
          expect(
            await screen.findByText("「たいあたり」「なきごえ」「でんきショック」を覚えるよ"),
          ).toBeInTheDocument();
        });

        it("覚える技がでんきショックの 1 件なら、「「でんきショック」を覚えるよ」と表示される", async () => {
          renderNameGuess({ attemptsRemaining: 1, hintResult: TYPE_AND_MOVE_HINT, onHint: vi.fn() });
          expect(await screen.findByText("「でんきショック」を覚えるよ")).toBeInTheDocument();
        });

        it("覚える技が 0 件なら、「このポケモンはレベルアップで覚える技がないみたいだよ」と表示される", async () => {
          const hint: HintResponse = { types: ["electric"], moves: [], attempts_remaining: 1 };
          renderNameGuess({ attemptsRemaining: 1, hintResult: hint, onHint: vi.fn() });
          expect(
            await screen.findByText("このポケモンはレベルアップで覚える技がないみたいだよ"),
          ).toBeInTheDocument();
        });
      });
    });
  });

  describe("ヒントボタンを押すと", () => {
    describe("部品間結合テスト", () => {
      describe("正常系", () => {
        it.each<[string, string, Partial<NameGuessProps>]>([
          ["ヒントをまだ使っていないとき", HINT_BUTTON, { attemptsRemaining: 3 }],
          [
            "タイプのヒントを取得済みのとき",
            HINT_BUTTON_AGAIN,
            { attemptsRemaining: 2, hintResult: TYPE_HINT_2_LEFT },
          ],
        ])("%s、ヒントが 1 回要求される", async (_given, buttonName, props) => {
          const user = userEvent.setup();
          const onHint = vi.fn().mockResolvedValue(undefined);
          renderNameGuess({ ...props, onHint });
          await user.click(screen.getByRole("button", { name: buttonName }));
          expect(onHint).toHaveBeenCalledTimes(1);
        });
      });
    });
  });

  describe("ヒントの要求が完了する前に、ヒントボタンを連打したとき", () => {
    async function clickHintButtonTwiceBeforeCompletion() {
      let resolveHint: () => void = () => {};
      const onHint = vi.fn(() => new Promise<void>((resolve) => { resolveHint = resolve; }));
      renderNameGuess({ onHint });
      const button = screen.getByRole("button", { name: HINT_BUTTON });

      // userEvent は各操作の間で状態更新を待ち、同一tick内の連打を再現できないため、click() を直接 2 回呼ぶ
      await act(async () => {
        button.click();
        button.click();
      });

      return { onHint, button, completeHint: () => act(async () => resolveHint()) };
    }

    describe("部品間結合テスト", () => {
      describe("異常系", () => {
        it("ヒントは 1 回だけ要求される", async () => {
          const { onHint, completeHint } = await clickHintButtonTwiceBeforeCompletion();
          expect(onHint).toHaveBeenCalledTimes(1);
          await completeHint();
        });

        it("ヒントボタンは押せない状態になる", async () => {
          const { button, completeHint } = await clickHintButtonTwiceBeforeCompletion();
          expect(button).toBeDisabled();
          await completeHint();
        });
      });
    });
  });
});
