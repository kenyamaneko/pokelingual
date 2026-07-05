import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { spec } from "../../test/labels";
import { CaptureResult, CAPTURE_RESULT_LABELS } from "./CaptureResult";
import { renderWithProviders } from "../../test/render";
import type { CaptureResponse } from "../../../../shared/api-types/quest";

// API モックは MSW の既定ハンドラで賄う (このコンポーネントは未ログイン描画のため /usage も飛ばない)。

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

/**
 * CaptureResult の仕様:
 * - captured=true なら捕獲タイトル、false なら逃走タイトルを表示する
 * - 「メニューに もどる」でホーム (/) へ遷移する
 *
 * 「つぎの ぼうけんへ」で次の出題が始まる結合は、実際に新しい出題画面が出る結果を
 * 観測するため QuestPage.test.tsx (公開入口からのフロー) で確かめる。
 * テスト対象外: 画像 src/ポケモン名/スコア の "props 透過" 表示は仕様ではなく、
 * Render が動けば成立するため検証しない。
 */
describe("CaptureResult", () => {
  it("captured=true で捕獲タイトル (ポケモン名入り) を表示する", () => {
    renderWithProviders(
      <CaptureResult result={baseResult()} onNewQuest={vi.fn()} />,
      { withRouter: true },
    );
    expect(
      screen.getByText(spec(CAPTURE_RESULT_LABELS.capturedTitle("ピカチュウ"))),
    ).toBeInTheDocument();
  });

  it("captured=false で逃走タイトルを表示する", () => {
    renderWithProviders(
      <CaptureResult
        result={baseResult({ captured: false })}
        onNewQuest={vi.fn()}
      />,
      { withRouter: true },
    );
    expect(
      screen.getByText(spec(CAPTURE_RESULT_LABELS.escapedTitle("ピカチュウ"))),
    ).toBeInTheDocument();
  });

  it("「メニューに戻る」ボタンでホーム (/) へ遷移する", async () => {
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

    await user.click(
      screen.getByRole("button", { name: CAPTURE_RESULT_LABELS.backToMenuButton }),
    );

    expect(screen.getByTestId("home-page")).toBeInTheDocument();
  });
});
