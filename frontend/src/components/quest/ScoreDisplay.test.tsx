import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ScoreDisplay } from "./ScoreDisplay";

describe("ScoreDisplay", () => {
  it("displays damage and HP", () => {
    // Given: a ScoreDisplay with score 85
    render(<ScoreDisplay score={{ score: 85, description_ja: "" }} />);
    // Then: damage value and remaining HP are displayed
    expect(screen.getByText("85")).toBeInTheDocument();
    expect(screen.getByText("ダメージ")).toBeInTheDocument();
    expect(screen.getByText("HP")).toBeInTheDocument();
    expect(screen.getByText("15/100")).toBeInTheDocument();
  });

  it("shows いちげきひっさつ for score 100", () => {
    // Given: a ScoreDisplay with score 100
    render(<ScoreDisplay score={{ score: 100, description_ja: "" }} />);
    // Then: shows one-hit KO label
    expect(screen.getByText("いちげきひっさつ！")).toBeInTheDocument();
  });

  it("shows ばつぐん for score >= 80", () => {
    // Given: a ScoreDisplay with score 85
    render(<ScoreDisplay score={{ score: 85, description_ja: "" }} />);
    // Then: shows super effective label
    expect(screen.getByText("こうかはばつぐんだ！")).toBeInTheDocument();
  });

  it("shows no label for score 41-79", () => {
    // Given: a ScoreDisplay with score 60
    render(<ScoreDisplay score={{ score: 60, description_ja: "" }} />);
    // Then: no evaluation label is shown
    expect(screen.queryByText("こうかはばつぐんだ！")).not.toBeInTheDocument();
    expect(screen.queryByText("こうかはいまひとつのようだ")).not.toBeInTheDocument();
  });

  it("shows いまひとつ for score 1-40", () => {
    // Given: a ScoreDisplay with score 15
    render(<ScoreDisplay score={{ score: 15, description_ja: "" }} />);
    // Then: shows not very effective label
    expect(screen.getByText("こうかはいまひとつのようだ")).toBeInTheDocument();
  });

  it("shows こうかがない for score 0", () => {
    // Given: a ScoreDisplay with score 0
    render(<ScoreDisplay score={{ score: 0, description_ja: "" }} />);
    // Then: shows no effect label
    expect(screen.getByText("こうかがないみたいだ...")).toBeInTheDocument();
  });
});
