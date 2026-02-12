import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { QuestCard } from "./QuestCard";

describe("QuestCard", () => {
  it("displays the English description", () => {
    // Given: a QuestCard with an English description
    render(
      <QuestCard description="It stores static electricity in its cheeks." />
    );
    // Then: the description is displayed
    expect(
      screen.getByText(/It stores static electricity in its cheeks./)
    ).toBeInTheDocument();
  });

  it("shows instruction text in Japanese", () => {
    // Given: a QuestCard is rendered
    render(<QuestCard description="Test description" />);
    // Then: the Japanese instruction text is shown
    expect(
      screen.getByText("この 英文を 日本語に 翻訳しよう！")
    ).toBeInTheDocument();
  });

  it("shows the Who's That Pokemon heading", () => {
    // Given: a QuestCard is rendered
    render(<QuestCard description="Test" />);
    // Then: the heading is shown
    expect(screen.getByText("Who's That Pokemon?")).toBeInTheDocument();
  });
});
