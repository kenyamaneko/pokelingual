import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ProfessorChat } from "./ProfessorChat";
import type { ChatContext } from "../../types";

// jsdom doesn't support scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

vi.mock("../../services/questApi", () => ({
  questApi: {
    chat: vi.fn().mockResolvedValue({
      data: { reply: "テスト用の 博士の 返答だよ。" },
    }),
  },
}));

const chatContext: ChatContext = {
  description_en: "It stores electricity in its cheeks.",
  description_ja: "ほっぺに でんきを ためている。",
  translation: "ほっぺに 電気を ためている。",
  score: 80,
  review: "よく 頑張ったな！",
  name_en: "Pikachu",
  name_ja: "ピカチュウ",
};

describe("ProfessorChat", () => {
  it("renders the chat modal with header", () => {
    // Given: the chat modal is open
    render(<ProfessorChat context={chatContext} onClose={vi.fn()} />);
    // Then: the header is displayed
    expect(screen.getByText("博士に 質問")).toBeInTheDocument();
  });

  it("shows placeholder text when no messages", () => {
    // Given: the chat modal is open with no messages
    render(<ProfessorChat context={chatContext} onClose={vi.fn()} />);
    // Then: placeholder text is displayed
    expect(screen.getByText(/博士に 聞いてみよう/)).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", async () => {
    // Given: the chat modal is open
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ProfessorChat context={chatContext} onClose={onClose} />);

    // When: clicking the close button
    await user.click(screen.getByText("\u00D7"));

    // Then: onClose is called
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("sends a message and displays professor reply", async () => {
    // Given: the chat modal is open
    const user = userEvent.setup();
    render(<ProfessorChat context={chatContext} onClose={vi.fn()} />);

    // When: typing and sending a message
    const input = screen.getByPlaceholderText("質問を 入力…");
    await user.type(input, "emitってどういう意味？");
    await user.click(screen.getByText("送信"));

    // Then: user message appears and professor replies
    expect(screen.getByText("emitってどういう意味？")).toBeInTheDocument();
    expect(await screen.findByText("テスト用の 博士の 返答だよ。")).toBeInTheDocument();
  });
});
