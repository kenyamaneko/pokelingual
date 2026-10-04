import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router";
import { spec } from "../../test/labels";
import { CaptureResult } from "./CaptureResult";
import { renderWithProviders } from "../../test/render";
import type { CaptureResponse } from "../../../../shared/api-types/quest";

function baseResult(overrides: Partial<CaptureResponse> = {}): CaptureResponse {
  return {
    captured: true,
    probability: 0.85,
    pokemon_id: 25,
    name_en: "Pikachu",
    name_ja: "ピカチュウ",
    sprite_url: "https://example.com/pikachu.png",
    score: 90,
    description_en: "desc en",
    description_ja: "desc ja",
    base_stat_total: 320,
    ball_type: "ultra",
    types: ["electric"],
    height: 4,
    weight: 60,
    is_legendary: false,
    is_mythical: false,
    ...overrides,
  };
}

const LEGENDARY_IDENTITY = { pokemon_id: 150, name_en: "Mewtwo", name_ja: "ミュウツー" };

describe("[クエスト] 捕獲結果画面", () => {
  describe("正常系", () => {
    describe("捕獲に成功し、伝説でも幻でもないとき", () => {
      it.each([
        [
          320,
          "やったー！　ピカチュウを　捕まえたぞ！",
          { pokemon_id: 25, name_en: "Pikachu", name_ja: "ピカチュウ" },
        ],
        [599, "やったー！　ミュウツーを　捕まえたぞ！", LEGENDARY_IDENTITY],
      ])("種族値が %i のとき、「%s」と表示される", (baseStatTotal, title, identity) => {
        renderWithProviders(
          <CaptureResult
            result={baseResult({ ...identity, base_stat_total: baseStatTotal })}
            onNewQuest={vi.fn()}
          />,
          { withRouter: true },
        );
        expect(screen.getByText(spec(title))).toBeInTheDocument();
      });

      it("種族値が 600 のとき、「やったー！　強そうな　ミュウツーを　捕まえたぞ！」と表示される", () => {
        renderWithProviders(
          <CaptureResult
            result={baseResult({ ...LEGENDARY_IDENTITY, base_stat_total: 600 })}
            onNewQuest={vi.fn()}
          />,
          { withRouter: true },
        );
        expect(
          screen.getByText(spec("やったー！　強そうな　ミュウツーを　捕まえたぞ！")),
        ).toBeInTheDocument();
      });
    });

    describe("捕獲に成功し、種族値が 680 のとき", () => {
      it("伝説なら、「やったー！　伝説の　ミュウツーを　捕まえたぞ！」と表示される", () => {
        renderWithProviders(
          <CaptureResult
            result={baseResult({
              ...LEGENDARY_IDENTITY,
              base_stat_total: 680,
              is_legendary: true,
              is_mythical: false,
            })}
            onNewQuest={vi.fn()}
          />,
          { withRouter: true },
        );
        expect(
          screen.getByText(spec("やったー！　伝説の　ミュウツーを　捕まえたぞ！")),
        ).toBeInTheDocument();
      });

      it("幻なら、「信じられない！　幻の　ミュウツーを　捕まえたぞ！」と表示される", () => {
        renderWithProviders(
          <CaptureResult
            result={baseResult({
              ...LEGENDARY_IDENTITY,
              base_stat_total: 680,
              is_legendary: false,
              is_mythical: true,
            })}
            onNewQuest={vi.fn()}
          />,
          { withRouter: true },
        );
        expect(
          screen.getByText(spec("信じられない！　幻の　ミュウツーを　捕まえたぞ！")),
        ).toBeInTheDocument();
      });
    });

    it("捕獲に失敗したとき、「野生の　ピカチュウは　逃げ出した！」と表示される", () => {
      renderWithProviders(
        <CaptureResult
          result={baseResult({ captured: false })}
          onNewQuest={vi.fn()}
        />,
        { withRouter: true },
      );
      expect(
        screen.getByText(spec("野生の　ピカチュウは　逃げ出した！")),
      ).toBeInTheDocument();
    });

    it("ポケモンのタイプがでんきのとき、「でんき」と表示される", () => {
      renderWithProviders(
        <CaptureResult result={baseResult()} onNewQuest={vi.fn()} />,
        { withRouter: true },
      );
      expect(screen.getByText("でんき")).toBeInTheDocument();
    });

    it("「メニューに戻る」を押すと、ホーム画面が表示される", async () => {
      const user = userEvent.setup();
      render(
        <MemoryRouter initialEntries={["/quest"]}>
          <Routes>
            <Route
              path="/quest"
              element={
                <CaptureResult
                  result={baseResult()}
                  onNewQuest={vi.fn()}
                />
              }
            />
            <Route path="/" element={<div data-testid="home-page" />} />
          </Routes>
        </MemoryRouter>,
      );

      await user.click(screen.getByRole("button", { name: "メニューに戻る" }));

      expect(screen.getByTestId("home-page")).toBeInTheDocument();
    });
  });
});
