import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import type { ReactNode } from "react";
import { ProfessorChat } from "./ProfessorChat";
import { AuthContext } from "../../contexts/AuthContext";
import { UsageProvider } from "../../contexts/UsageContext";
import type { ChatContext } from "../../types";

// jsdom doesn't support scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

vi.mock("../../services/questApi", () => ({
  questApi: {
    replyToChat: vi.fn().mockResolvedValue({
      data: { reply: "テスト用の 博士の 返答だよ。" },
    }),
  },
}));

vi.mock("../../services/usageApi", () => ({
  usageApi: { get: vi.fn().mockResolvedValue({ data: { count: 0, limit: 30 } }) },
}));

function renderWithProviders(ui: ReactNode) {
  return render(
    <AuthContext.Provider
      value={{
        user: null,
        loading: false,
        login: async () => {},
        loginWithGoogle: async () => {},
        logout: async () => {},
      }}
    >
      <UsageProvider>{ui}</UsageProvider>
    </AuthContext.Provider>,
  );
}

const chatContext: ChatContext = {
  description_en: "It stores electricity in its cheeks.",
  description_ja: "ほっぺに でんきを ためている。",
  translation: "ほっぺに 電気を ためている。",
  score: 80,
  review: "よく 頑張ったな！",
  name_en: "Pikachu",
  name_ja: "ピカチュウ",
};

// NOTE: コンポーネント側は全角スペース（U+3000）を使用しているが、
// Testing Library の getByText は \s+ を半角スペースに正規化するため、
// テストのアサーションでは半角スペースを使う。
describe("ProfessorChat", () => {
  it("renders the chat modal with header", () => {
    // Given: the chat modal is open
    renderWithProviders(<ProfessorChat context={chatContext} onClose={vi.fn()} />);
    // Then: the header is displayed
    expect(screen.getByText("はかせに しつもん")).toBeInTheDocument();
  });

  it("shows placeholder text when no messages", () => {
    // Given: the chat modal is open with no messages
    renderWithProviders(<ProfessorChat context={chatContext} onClose={vi.fn()} />);
    // Then: placeholder text is displayed
    expect(screen.getByText(/はかせに 聞いてみよう/)).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", async () => {
    // Given: the chat modal is open
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<ProfessorChat context={chatContext} onClose={onClose} />);

    // When: clicking the close button
    await user.click(screen.getByText("\u00D7"));

    // Then: onClose is called
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("sends a message and displays professor reply", async () => {
    // Given: the chat modal is open
    const user = userEvent.setup();
    renderWithProviders(<ProfessorChat context={chatContext} onClose={vi.fn()} />);

    // When: typing and sending a message
    const input = screen.getByPlaceholderText("しつもんを 入力してね");
    await user.type(input, "emitってどういう意味？");
    await user.click(screen.getByText("はかせに 聞く"));

    // Then: user message appears and professor replies
    expect(screen.getByText("emitってどういう意味？")).toBeInTheDocument();
    expect(await screen.findByText("テスト用の 博士の 返答だよ。")).toBeInTheDocument();
  });
});
