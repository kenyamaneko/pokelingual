import type { ComponentProps } from "react";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, vi } from "vitest";
import { spec } from "../../test/labels";
import { defineCase } from "../../test/defineCase";
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

type NameGuessScenario = { given: string; props: Partial<NameGuessProps> };

const OPEN_NAME_GUESS = "名前当て画面を開く";
const NOT_ANSWERED_YET = "まだ名前当てに答えていないとき";
const WRONG_2_LEFT_GIVEN = "不正解で残り挑戦回数が 2 回のとき";
const WRONG_1_LEFT_GIVEN = "不正解で残り挑戦回数が 1 回のとき";
const CORRECT_GIVEN = "名前当てに正解しているとき";
const HINT_BUTTON_SHOWN = "「ヒントを見る（チャンスを1回使う）」ボタンが表示される";
const HINT_BUTTON_HIDDEN = "「ヒントを見る（チャンスを1回使う）」ボタンが表示されない";
const HINT_AGAIN_BUTTON_HIDDEN = "「別のヒントを見る（チャンスを1回使う）」ボタンが表示されない";
const HINT_UNAVAILABLE_SHOWN = "「もうヒントは使えないよ」と表示される";
const ONE_LEFT_TYPE_HINT_GIVEN = "残り挑戦回数が 1 回で、タイプのヒントを取得済みのとき";
const ONE_LEFT_TYPE_AND_MOVE_HINT_GIVEN = "残り挑戦回数が 1 回で、タイプと技の両方のヒントを取得済みのとき";

describe("[本体:名前当て]名前当ての入力と結果表示", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        { Given: NOT_ANSWERED_YET, When: [OPEN_NAME_GUESS], Then: "入力欄が入力できる状態で表示される" },
      ],
    },
    () => {
      renderNameGuess();
      expect(screen.getByRole("textbox")).toBeEnabled();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: "まだ名前当てに答えておらず、入力欄が空のとき",
          When: [OPEN_NAME_GUESS],
          Then: "「君に　決めた！」ボタンは押せない状態になる",
        },
      ],
    },
    () => {
      renderNameGuess();
      expect(screen.getByRole("button", { name: SUBMIT_BUTTON })).toBeDisabled();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [{ Given: WRONG_2_LEFT_GIVEN, When: [OPEN_NAME_GUESS], Then: "入力欄が表示される" }],
    },
    () => {
      renderNameGuess({ guessResult: WRONG_GUESS_2_LEFT, attemptsRemaining: 2 });
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: WRONG_2_LEFT_GIVEN,
          When: [OPEN_NAME_GUESS],
          Then: "「はずれ…　もう一度やってみよう！」と表示される",
        },
      ],
    },
    () => {
      renderNameGuess({ guessResult: WRONG_GUESS_2_LEFT, attemptsRemaining: 2 });
      expect(screen.getByText(spec("はずれ…　もう一度やってみよう！"))).toBeInTheDocument();
    },
  );

  const submitButtonScenarios: NameGuessScenario[] = [
    { given: NOT_ANSWERED_YET, props: {} },
    { given: WRONG_2_LEFT_GIVEN, props: { guessResult: WRONG_GUESS_2_LEFT, attemptsRemaining: 2 } },
  ];
  for (const { given, props } of submitButtonScenarios) {
    defineCase(
      {
        種別: "部品間結合テスト",
        正常異常: "正常系",
        steps: [{ Given: given, When: [OPEN_NAME_GUESS], Then: "「君に　決めた！」ボタンが表示される" }],
      },
      () => {
        renderNameGuess(props);
        expect(screen.getByRole("button", { name: SUBMIT_BUTTON })).toBeInTheDocument();
      },
    );
  }

  const textboxHiddenScenarios: NameGuessScenario[] = [
    {
      given: "不正解で残り挑戦回数が 0 回のとき",
      props: { guessResult: { correct: false, attempts_remaining: 0 }, attemptsRemaining: 0 },
    },
    { given: CORRECT_GIVEN, props: { guessResult: CORRECT_GUESS, attemptsRemaining: 2 } },
  ];
  for (const { given, props } of textboxHiddenScenarios) {
    defineCase(
      {
        種別: "部品間結合テスト",
        正常異常: "正常系",
        steps: [{ Given: given, When: [OPEN_NAME_GUESS], Then: "入力欄が表示されなくなる" }],
      },
      () => {
        renderNameGuess(props);
        expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      },
    );
  }

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: WRONG_1_LEFT_GIVEN,
          When: [OPEN_NAME_GUESS],
          Then: "「はずれ…　ラストチャンス！」と表示される",
        },
      ],
    },
    () => {
      renderNameGuess({ guessResult: WRONG_GUESS_1_LEFT, attemptsRemaining: 1 });
      expect(screen.getByText(spec("はずれ…　ラストチャンス！"))).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "不正解で残り挑戦回数が 0 回のとき",
          When: [OPEN_NAME_GUESS],
          Then: "「残念...」と表示される",
        },
      ],
    },
    () => {
      const guess: GuessResponse = { correct: false, attempts_remaining: 0 };
      renderNameGuess({ guessResult: guess, attemptsRemaining: 0 });
      expect(screen.getByText(spec("残念..."))).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [{ Given: CORRECT_GIVEN, When: [OPEN_NAME_GUESS], Then: "「正解！」と表示される" }],
    },
    () => {
      renderNameGuess({ guessResult: CORRECT_GUESS, attemptsRemaining: 2 });
      expect(screen.getByText(spec("正解！"))).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [{ Given: CORRECT_GIVEN, When: [OPEN_NAME_GUESS], Then: "「次へ進む」ボタンが表示される" }],
    },
    () => {
      renderNameGuess({ guessResult: CORRECT_GUESS, attemptsRemaining: 2 });
      expect(screen.getByRole("button", { name: PROCEED_BUTTON })).toBeInTheDocument();
    },
  );
});

describe("[本体:名前当て]残り挑戦回数の表示", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "残り挑戦回数がまだ分からないとき",
          When: [OPEN_NAME_GUESS],
          Then: "残り挑戦回数の表示が出ない",
        },
      ],
    },
    () => {
      renderNameGuess({ attemptsRemaining: null, maxGuessAttempts: null });
      expect(screen.queryByRole("meter", { name: "残り挑戦回数" })).not.toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "最大挑戦回数が 3 回で残り挑戦回数が 2 回のとき",
          When: [OPEN_NAME_GUESS],
          Then: "残り挑戦回数の表示が 3 回中 2 回を示す",
        },
      ],
    },
    () => {
      renderNameGuess({ guessResult: WRONG_GUESS_2_LEFT, attemptsRemaining: 2, maxGuessAttempts: 3 });
      const meter = screen.getByRole("meter", { name: "残り挑戦回数" });
      expect(meter).toHaveAttribute("aria-valuenow", "2");
      expect(meter).toHaveAttribute("aria-valuemax", "3");
    },
  );
});

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

describe("[本体:名前当て]名前当てのヒント表示", () => {
  const hintButtonHiddenScenarios: NameGuessScenario[] = [
    { given: "チュートリアルの名前当て画面のとき", props: {} },
    {
      given: CORRECT_GIVEN,
      props: { guessResult: CORRECT_GUESS, attemptsRemaining: 2, onHint: vi.fn() },
    },
    {
      given: "ヒントをまだ使っておらず、残り挑戦回数が 1 回のとき",
      props: { guessResult: WRONG_GUESS_1_LEFT, attemptsRemaining: 1, onHint: vi.fn() },
    },
  ];
  for (const { given, props } of hintButtonHiddenScenarios) {
    defineCase(
      {
        種別: "部品間結合テスト",
        正常異常: "正常系",
        steps: [{ Given: given, When: [OPEN_NAME_GUESS], Then: HINT_BUTTON_HIDDEN }],
      },
      () => {
        renderNameGuess(props);
        expect(screen.queryByRole("button", { name: HINT_BUTTON })).not.toBeInTheDocument();
      },
    );
  }

  const hintButtonShownScenarios: NameGuessScenario[] = [
    {
      given: "まだ名前当てに答えておらず、残り挑戦回数がまだ分からないとき",
      props: { attemptsRemaining: null, maxGuessAttempts: null, onHint: vi.fn() },
    },
    {
      given: WRONG_2_LEFT_GIVEN,
      props: { guessResult: WRONG_GUESS_2_LEFT, attemptsRemaining: 2, onHint: vi.fn() },
    },
  ];
  for (const { given, props } of hintButtonShownScenarios) {
    defineCase(
      {
        種別: "部品間結合テスト",
        正常異常: "正常系",
        steps: [{ Given: given, When: [OPEN_NAME_GUESS], Then: HINT_BUTTON_SHOWN }],
      },
      () => {
        renderNameGuess(props);
        expect(screen.getByRole("button", { name: HINT_BUTTON })).toBeInTheDocument();
      },
    );
  }

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "タイプのヒントを取得済みで、残り挑戦回数が 2 回のとき",
          When: [OPEN_NAME_GUESS],
          Then: "「別のヒントを見る（チャンスを1回使う）」ボタンが表示される",
        },
      ],
    },
    () => {
      renderNameGuess({ attemptsRemaining: 2, hintResult: TYPE_HINT_2_LEFT, onHint: vi.fn() });
      expect(screen.getByRole("button", { name: HINT_BUTTON_AGAIN })).toBeInTheDocument();
    },
  );

  const hintAgainButtonHiddenScenarios: NameGuessScenario[] = [
    {
      given: ONE_LEFT_TYPE_HINT_GIVEN,
      props: { attemptsRemaining: 1, hintResult: TYPE_HINT_1_LEFT, onHint: vi.fn() },
    },
    {
      given: ONE_LEFT_TYPE_AND_MOVE_HINT_GIVEN,
      props: { attemptsRemaining: 1, hintResult: TYPE_AND_MOVE_HINT, onHint: vi.fn() },
    },
  ];
  for (const { given, props } of hintAgainButtonHiddenScenarios) {
    defineCase(
      {
        種別: "部品間結合テスト",
        正常異常: "正常系",
        steps: [{ Given: given, When: [OPEN_NAME_GUESS], Then: HINT_AGAIN_BUTTON_HIDDEN }],
      },
      () => {
        renderNameGuess(props);
        expect(screen.queryByRole("button", { name: HINT_BUTTON_AGAIN })).not.toBeInTheDocument();
      },
    );
  }

  const hintUnavailableScenarios: NameGuessScenario[] = [
    {
      given: "残り挑戦回数が 1 回で、ヒントをまだ使っていないとき",
      props: { guessResult: WRONG_GUESS_1_LEFT, attemptsRemaining: 1, onHint: vi.fn() },
    },
    {
      given: ONE_LEFT_TYPE_HINT_GIVEN,
      props: { attemptsRemaining: 1, hintResult: TYPE_HINT_1_LEFT, onHint: vi.fn() },
    },
  ];
  for (const { given, props } of hintUnavailableScenarios) {
    defineCase(
      {
        種別: "部品間結合テスト",
        正常異常: "正常系",
        steps: [{ Given: given, When: [OPEN_NAME_GUESS], Then: HINT_UNAVAILABLE_SHOWN }],
      },
      () => {
        renderNameGuess(props);
        expect(screen.getByText(HINT_UNAVAILABLE)).toBeInTheDocument();
      },
    );
  }

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: ONE_LEFT_TYPE_AND_MOVE_HINT_GIVEN,
          When: [OPEN_NAME_GUESS],
          Then: "「もうヒントは使えないよ」と表示されない",
        },
      ],
    },
    () => {
      renderNameGuess({ attemptsRemaining: 1, hintResult: TYPE_AND_MOVE_HINT, onHint: vi.fn() });
      expect(screen.queryByText(HINT_UNAVAILABLE)).not.toBeInTheDocument();
    },
  );

  const electricTypeHintScenarios: NameGuessScenario[] = [
    {
      given: "タイプ「でんき」を含むヒントを取得済みで、ヒントがタイプ「でんき」だけのとき",
      props: { attemptsRemaining: 2, hintResult: TYPE_HINT_2_LEFT },
    },
    {
      given: "タイプ「でんき」を含むヒントを取得済みで、ヒントがタイプ「でんき」と覚える技「でんきショック」のとき",
      props: { attemptsRemaining: 1, hintResult: TYPE_AND_MOVE_HINT },
    },
  ];
  for (const { given, props } of electricTypeHintScenarios) {
    defineCase(
      {
        種別: "部品間結合テスト",
        正常異常: "正常系",
        steps: [
          { Given: given, When: [OPEN_NAME_GUESS], Then: "「でんきタイプのポケモンだよ」と表示される" },
        ],
      },
      async () => {
        renderNameGuess({ ...props, onHint: vi.fn() });
        expect(await screen.findByText("でんきタイプのポケモンだよ")).toBeInTheDocument();
      },
    );
  }

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "タイプのヒントを取得済みで、タイプがくさとどくの複合のとき",
          When: [OPEN_NAME_GUESS],
          Then: "「くさ・どくタイプのポケモンだよ」と表示される",
        },
      ],
    },
    async () => {
      const hint: HintResponse = { types: ["grass", "poison"], attempts_remaining: 2 };
      renderNameGuess({ attemptsRemaining: 2, hintResult: hint, onHint: vi.fn() });
      expect(await screen.findByText("くさ・どくタイプのポケモンだよ")).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "技のヒントを取得済みで、覚える技がたいあたり・なきごえ・でんきショックの 3 件のとき",
          When: [OPEN_NAME_GUESS],
          Then: "「「たいあたり」「なきごえ」「でんきショック」を覚えるよ」と表示される",
        },
      ],
    },
    async () => {
      const hint: HintResponse = {
        types: ["electric"],
        moves: ["たいあたり", "なきごえ", "でんきショック"],
        attempts_remaining: 1,
      };
      renderNameGuess({ attemptsRemaining: 1, hintResult: hint, onHint: vi.fn() });
      expect(
        await screen.findByText("「たいあたり」「なきごえ」「でんきショック」を覚えるよ"),
      ).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "技のヒントを取得済みで、覚える技がでんきショックの 1 件のとき",
          When: [OPEN_NAME_GUESS],
          Then: "「「でんきショック」を覚えるよ」と表示される",
        },
      ],
    },
    async () => {
      renderNameGuess({ attemptsRemaining: 1, hintResult: TYPE_AND_MOVE_HINT, onHint: vi.fn() });
      expect(await screen.findByText("「でんきショック」を覚えるよ")).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "技のヒントを取得済みで、覚える技が 0 件のとき",
          When: [OPEN_NAME_GUESS],
          Then: "「このポケモンはレベルアップで覚える技がないみたいだよ」と表示される",
        },
      ],
    },
    async () => {
      const hint: HintResponse = { types: ["electric"], moves: [], attempts_remaining: 1 };
      renderNameGuess({ attemptsRemaining: 1, hintResult: hint, onHint: vi.fn() });
      expect(
        await screen.findByText("このポケモンはレベルアップで覚える技がないみたいだよ"),
      ).toBeInTheDocument();
    },
  );

  const hintRequestScenarios: (NameGuessScenario & { buttonName: string })[] = [
    { given: "ヒントをまだ使っていないとき", buttonName: HINT_BUTTON, props: { attemptsRemaining: 3 } },
    {
      given: "タイプのヒントを取得済みのとき",
      buttonName: HINT_BUTTON_AGAIN,
      props: { attemptsRemaining: 2, hintResult: TYPE_HINT_2_LEFT },
    },
  ];
  for (const { given, buttonName, props } of hintRequestScenarios) {
    defineCase(
      {
        種別: "部品間結合テスト",
        正常異常: "正常系",
        steps: [{ Given: given, When: [`名前当て画面のヒント表示で、「${buttonName}」ボタンを押す`], Then: "ヒントが 1 回要求される" }],
      },
      async () => {
        const user = userEvent.setup();
        const onHint = vi.fn().mockResolvedValue(undefined);
        renderNameGuess({ ...props, onHint });
        await user.click(screen.getByRole("button", { name: buttonName }));
        expect(onHint).toHaveBeenCalledTimes(1);
      },
    );
  }

  const HINT_RETRIEVAL_SLOW = "ヒントの取得に時間がかかるとき";
  const CLICK_HINT_BUTTON_TWICE = [
    `名前当て画面のヒント表示で、「${HINT_BUTTON}」ボタンを押す`,
    `名前当て画面のヒント表示で、「${HINT_BUTTON}」ボタンを押す`,
  ] as const;

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [
        { Given: HINT_RETRIEVAL_SLOW, When: CLICK_HINT_BUTTON_TWICE, Then: "ヒントは 1 回だけ要求される" },
      ],
    },
    async () => {
      const { onHint, completeHint } = await clickHintButtonTwiceBeforeCompletion();
      expect(onHint).toHaveBeenCalledTimes(1);
      await completeHint();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [
        { Given: HINT_RETRIEVAL_SLOW, When: CLICK_HINT_BUTTON_TWICE, Then: "ヒントボタンは押せない状態になる" },
      ],
    },
    async () => {
      const { button, completeHint } = await clickHintButtonTwiceBeforeCompletion();
      expect(button).toBeDisabled();
      await completeHint();
    },
  );
});
