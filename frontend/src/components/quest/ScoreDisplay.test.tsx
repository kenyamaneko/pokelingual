import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ScoreDisplay } from "./ScoreDisplay";

// NOTE: コンポーネント側は全角スペース（U+3000）を使用しているが、
// Testing Library の getByText は \s+ を半角スペースに正規化するため、
// テストのアサーションでは半角スペースを使う。
describe("ScoreDisplay", () => {
  it("displays damage and HP", () => {
    // Given: a ScoreDisplay with score 85
    render(<ScoreDisplay score={{ score: 85, review: "", description_ja: "" }} />);
    // Then: damage value and remaining HP are displayed
    expect(screen.getByText("85")).toBeInTheDocument();
    expect(screen.getByText("ダメージ")).toBeInTheDocument();
    expect(screen.getByText("HP")).toBeInTheDocument();
    expect(screen.getByText("15/100")).toBeInTheDocument();
  });

  it("shows 一撃必殺 for score 100", () => {
    // Given: a ScoreDisplay with score 100
    render(<ScoreDisplay score={{ score: 100, review: "", description_ja: "" }} />);
    // Then: shows one-hit KO label
    expect(screen.getByText("いちげき ひっさつ！")).toBeInTheDocument();
  });

  it("shows ばつぐん for score >= 80", () => {
    // Given: a ScoreDisplay with score 85
    render(<ScoreDisplay score={{ score: 85, review: "", description_ja: "" }} />);
    // Then: shows super effective label
    expect(screen.getByText("こうかは ばつぐんだ！")).toBeInTheDocument();
  });

  it("shows no label for score 41-79", () => {
    // Given: a ScoreDisplay with score 60
    render(<ScoreDisplay score={{ score: 60, review: "", description_ja: "" }} />);
    // Then: no evaluation label is shown
    expect(screen.queryByText("こうかは ばつぐんだ！")).not.toBeInTheDocument();
    expect(screen.queryByText("こうかは いまひとつの ようだ")).not.toBeInTheDocument();
  });

  it("shows いまひとつ for score 1-40", () => {
    // Given: a ScoreDisplay with score 15
    render(<ScoreDisplay score={{ score: 15, review: "", description_ja: "" }} />);
    // Then: shows not very effective label
    expect(screen.getByText("こうかは いまひとつの ようだ")).toBeInTheDocument();
  });

  it("shows こうかがない for score 0", () => {
    // Given: a ScoreDisplay with score 0
    render(<ScoreDisplay score={{ score: 0, review: "", description_ja: "" }} />);
    // Then: shows no effect label
    expect(screen.getByText("こうかが ないみたいだ...")).toBeInTheDocument();
  });

  it("does not render review (review is shown in QuestPage)", () => {
    // Given: a ScoreDisplay with a review
    render(<ScoreDisplay score={{ score: 75, review: "テスト レビュー", description_ja: "" }} />);
    // Then: ScoreDisplay does not render the review text
    expect(screen.queryByText("テスト レビュー")).not.toBeInTheDocument();
  });
});
