import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { TranslationInput } from "./TranslationInput";

// NOTE: コンポーネント側は全角スペース（U+3000）を使用しているが、
// Testing Library の getByText は \s+ を半角スペースに正規化するため、
// テストのアサーションでは半角スペースを使う。
describe("TranslationInput", () => {
  it("renders textarea and submit button", () => {
    // Given: a TranslationInput is rendered
    render(<TranslationInput onSubmit={vi.fn()} />);
    // Then: textarea and button are present
    expect(
      screen.getByPlaceholderText("日本語を 入力してね")
    ).toBeInTheDocument();
    expect(screen.getByText("この ほんやくで たたかう！")).toBeInTheDocument();
  });

  it("button is disabled when textarea is empty", () => {
    // Given: a TranslationInput with no text entered
    render(<TranslationInput onSubmit={vi.fn()} />);
    // Then: the submit button is disabled
    const button = screen.getByText("この ほんやくで たたかう！");
    expect(button).toBeDisabled();
  });

  it("button is enabled when text is entered", async () => {
    // Given: a TranslationInput is rendered
    const user = userEvent.setup();
    render(<TranslationInput onSubmit={vi.fn()} />);

    // When: text is typed into the textarea
    const textarea = screen.getByPlaceholderText("日本語を 入力してね");
    await user.type(textarea, "テスト翻訳");

    // Then: the submit button becomes enabled
    const button = screen.getByText("この ほんやくで たたかう！");
    expect(button).not.toBeDisabled();
  });

  it("calls onSubmit with the entered text", async () => {
    // Given: a TranslationInput with an onSubmit handler
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<TranslationInput onSubmit={onSubmit} />);

    // When: text is entered and submit button is clicked
    const textarea = screen.getByPlaceholderText("日本語を 入力してね");
    await user.type(textarea, "テスト翻訳");
    const button = screen.getByText("この ほんやくで たたかう！");
    await user.click(button);

    // Then: onSubmit is called with the entered text
    expect(onSubmit).toHaveBeenCalledWith("テスト翻訳");
  });
});
