import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { CaptureResult } from "./CaptureResult";
import type { CaptureResponse } from "../../types";

const capturedResult: CaptureResponse = {
  captured: true,
  probability: 0.85,
  pokemon_id: 25,
  name_en: "Pikachu",
  name_ja: "ピカチュウ",
  sprite_url: "https://example.com/pikachu.png",
  score: 90,
  description_en: "When several of these Pokemon gather, their electricity could build and cause lightning storms.",
  description_ja: "何匹か 集まると そこに 激しい 雷が 落ちることがある。",
  base_stat_total: 320,
  ball_type: "ultra",
};

const escapedResult: CaptureResponse = {
  captured: false,
  probability: 0.3,
  pokemon_id: 25,
  name_en: "Pikachu",
  name_ja: "ピカチュウ",
  sprite_url: "https://example.com/pikachu.png",
  score: 30,
  description_en: "When several of these Pokemon gather, their electricity could build and cause lightning storms.",
  description_ja: "何匹か 集まると そこに 激しい 雷が 落ちることがある。",
  base_stat_total: 320,
  ball_type: "poke",
};

function renderWithRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
}

describe("CaptureResult", () => {
  it("shows capture message when captured", () => {
    // Given: a captured result
    renderWithRouter(<CaptureResult result={capturedResult} onNewQuest={vi.fn()} />);
    // Then: shows capture message
    expect(screen.getByText(/やったー！ ピカチュウを 捕まえたぞ！/)).toBeInTheDocument();
  });

  it("shows escape message when not captured", () => {
    // Given: an escaped result
    renderWithRouter(<CaptureResult result={escapedResult} onNewQuest={vi.fn()} />);
    // Then: shows escape message
    expect(screen.getByText(/野生の ピカチュウは 逃げ出した！/)).toBeInTheDocument();
  });

  it("displays Pokemon name in both languages", () => {
    // Given: a captured result
    renderWithRouter(<CaptureResult result={capturedResult} onNewQuest={vi.fn()} />);
    // Then: both English and Japanese names are displayed
    expect(screen.getByText("Pikachu")).toBeInTheDocument();
    expect(screen.getByText("ピカチュウ")).toBeInTheDocument();
  });

  it("displays score", () => {
    // Given: a captured result with score 90
    renderWithRouter(<CaptureResult result={capturedResult} onNewQuest={vi.fn()} />);
    // Then: score is displayed
    expect(screen.getByText("スコア: 90")).toBeInTheDocument();
  });

  it("calls onNewQuest when button is clicked", async () => {
    // Given: a CaptureResult with an onNewQuest handler
    const user = userEvent.setup();
    const onNewQuest = vi.fn();
    renderWithRouter(<CaptureResult result={capturedResult} onNewQuest={onNewQuest} />);

    // When: clicking the "次のクエストへ" button
    await user.click(screen.getByText("次の クエストへ"));

    // Then: onNewQuest is called
    expect(onNewQuest).toHaveBeenCalledOnce();
  });

  it("renders Pokemon sprite", () => {
    // Given: a captured result with a sprite URL
    renderWithRouter(<CaptureResult result={capturedResult} onNewQuest={vi.fn()} />);
    // Then: the sprite image is rendered with correct src
    const img = screen.getByAltText("Pikachu");
    expect(img).toHaveAttribute("src", "https://example.com/pikachu.png");
  });
});
