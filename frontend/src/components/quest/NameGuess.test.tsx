import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { NameGuess } from "./NameGuess";

// NOTE: コンポーネント側は全角スペース（U+3000）を使用しているが、
// Testing Library の getByText は \s+ を半角スペースに正規化するため、
// テストのアサーションでは半角スペースを使う。
describe("NameGuess", () => {
  it("renders input and buttons when no guess yet", () => {
    // Given: a NameGuess with no previous guess result
    render(
      <NameGuess onSubmit={vi.fn()} onSkip={vi.fn()} guessResult={null} />
    );
    // Then: input field, submit button, and skip button are present
    expect(
      screen.getByPlaceholderText("ポケモンの 名前を 入力してね")
    ).toBeInTheDocument();
    expect(screen.getByText("きみに きめた！")).toBeInTheDocument();
    expect(
      screen.getByText("わからないので スキップ →")
    ).toBeInTheDocument();
  });

  it("calls onSubmit with guess text", async () => {
    // Given: a NameGuess with an onSubmit handler
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <NameGuess onSubmit={onSubmit} onSkip={vi.fn()} guessResult={null} />
    );

    // When: typing "Pikachu" and clicking submit
    const input = screen.getByPlaceholderText("ポケモンの 名前を 入力してね");
    await user.type(input, "Pikachu");
    await user.click(screen.getByText("きみに きめた！"));

    // Then: onSubmit is called with "Pikachu"
    expect(onSubmit).toHaveBeenCalledWith("Pikachu");
  });

  it("shows correct message for English name", () => {
    // Given: a correct English name guess result with ultra ball
    render(
      <NameGuess
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
        guessResult={{
          correct: true,
          ball_type: "ultra",
          language: "en",
          attempts_remaining: 2,
        }}
      />
    );
    // Then: shows correct message with hyper ball bonus
    expect(screen.getByText("せいかい！")).toBeInTheDocument();
    expect(
      screen.getByText("えいご名 せいかい！ ハイパーボール ゲット！")
    ).toBeInTheDocument();
  });

  it("shows correct message for Japanese name", () => {
    // Given: a correct Japanese name guess result with great ball
    render(
      <NameGuess
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
        guessResult={{
          correct: true,
          ball_type: "great",
          language: "ja",
          attempts_remaining: 2,
        }}
      />
    );
    // Then: shows Japanese name correct message with super ball
    expect(
      screen.getByText("日本語名 せいかい！ スーパーボール ゲット！")
    ).toBeInTheDocument();
  });

  it("shows revealed name after 3 wrong guesses", () => {
    // Given: a wrong guess result with 0 attempts remaining (names revealed)
    render(
      <NameGuess
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
        guessResult={{
          correct: false,
          attempts_remaining: 0,
          reveal_name_en: "Pikachu",
          reveal_name_ja: "ピカチュウ",
        }}
      />
    );
    // Then: shows failure message and revealed names
    expect(screen.getByText("ざんねん！")).toBeInTheDocument();
    expect(
      screen.getByText(/Pikachu.*ピカチュウ/)
    ).toBeInTheDocument();
  });

  it("shows wrong message with remaining attempts", () => {
    // Given: a wrong guess result with 2 attempts remaining
    render(
      <NameGuess
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
        guessResult={{
          correct: false,
          attempts_remaining: 2,
        }}
      />
    );
    // Then: shows wrong message encouraging retry
    expect(
      screen.getByText("はずれ… もう一度 やってみよう！")
    ).toBeInTheDocument();
  });

  it("shows last chance message with 1 attempt remaining", () => {
    // Given: a wrong guess result with 1 attempt remaining
    render(
      <NameGuess
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
        guessResult={{
          correct: false,
          attempts_remaining: 1,
        }}
      />
    );
    // Then: shows last chance message
    expect(
      screen.getByText("はずれ… ラストチャンス！")
    ).toBeInTheDocument();
  });

  it("calls onSkip when skip button clicked", async () => {
    // Given: a NameGuess with an onSkip handler
    const user = userEvent.setup();
    const onSkip = vi.fn();
    render(
      <NameGuess onSubmit={vi.fn()} onSkip={onSkip} guessResult={null} />
    );

    // When: clicking the skip button
    await user.click(screen.getByText("わからないので スキップ →"));

    // Then: onSkip is called
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it("shows 'next' button text after guess is finished", () => {
    // Given: a correct guess result (guess phase complete)
    render(
      <NameGuess
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
        guessResult={{
          correct: true,
          ball_type: "ultra",
          language: "en",
          attempts_remaining: 2,
        }}
      />
    );
    // Then: shows "次へ進む" button instead of skip
    expect(screen.getByText("次へ すすむ →")).toBeInTheDocument();
  });
});
