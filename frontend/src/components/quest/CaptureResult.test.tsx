import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, vi } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router";
import { spec } from "../../test/labels";
import { CaptureResult } from "./CaptureResult";
import { renderWithProviders } from "../../test/render";
import { defineCase } from "../../test/defineCase";
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

const DUMMY_IDENTITY = { pokemon_id: 9999, name_en: "Testmon", name_ja: "テスト用ポケモン" };
const LEGENDARY_IDENTITY = { pokemon_id: 150, name_en: "Mewtwo", name_ja: "ミュウツー" };

function renderCaptureResult(result: CaptureResponse) {
  renderWithProviders(<CaptureResult result={result} onNewQuest={vi.fn()} />, {
    withRouter: true,
  });
}

const SHOW_RESULT = "捕獲結果画面を開く";
const NOT_SPECIAL_CAPTURED = "捕獲に成功し、伝説でも幻でもなく";
const MEWTWO_CAPTURED = "捕獲に成功し、種族値が 680 のミュウツーで";

describe("[本体:捕獲]捕獲結果画面", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: `${NOT_SPECIAL_CAPTURED}、種族値が 320 のピカチュウのとき`,
          When: [SHOW_RESULT],
          Then: "「やったー！　ピカチュウを　捕まえたぞ！」と表示される",
        },
      ],
    },
    () => {
      renderCaptureResult(baseResult({ base_stat_total: 320 }));
      expect(screen.getByText(spec("やったー！　ピカチュウを　捕まえたぞ！"))).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: `${NOT_SPECIAL_CAPTURED}、種族値が 599 のテスト用ポケモンのとき`,
          When: [SHOW_RESULT],
          Then: "「やったー！　テスト用ポケモンを　捕まえたぞ！」と表示される",
        },
      ],
    },
    () => {
      renderCaptureResult(baseResult({ ...DUMMY_IDENTITY, base_stat_total: 599 }));
      expect(screen.getByText(spec("やったー！　テスト用ポケモンを　捕まえたぞ！"))).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: `${NOT_SPECIAL_CAPTURED}、種族値が 600 のテスト用ポケモンのとき`,
          When: [SHOW_RESULT],
          Then: "「やったー！　強そうな　テスト用ポケモンを　捕まえたぞ！」と表示される",
        },
      ],
    },
    () => {
      renderCaptureResult(baseResult({ ...DUMMY_IDENTITY, base_stat_total: 600 }));
      expect(
        screen.getByText(spec("やったー！　強そうな　テスト用ポケモンを　捕まえたぞ！")),
      ).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: `${MEWTWO_CAPTURED}、伝説のとき`,
          When: [SHOW_RESULT],
          Then: "「やったー！　伝説の　ミュウツーを　捕まえたぞ！」と表示される",
        },
      ],
    },
    () => {
      renderCaptureResult(
        baseResult({
          ...LEGENDARY_IDENTITY,
          base_stat_total: 680,
          is_legendary: true,
          is_mythical: false,
        }),
      );
      expect(
        screen.getByText(spec("やったー！　伝説の　ミュウツーを　捕まえたぞ！")),
      ).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: `${MEWTWO_CAPTURED}、幻のとき`,
          When: [SHOW_RESULT],
          Then: "「信じられない！　幻の　ミュウツーを　捕まえたぞ！」と表示される",
        },
      ],
    },
    () => {
      renderCaptureResult(
        baseResult({
          ...LEGENDARY_IDENTITY,
          base_stat_total: 680,
          is_legendary: false,
          is_mythical: true,
        }),
      );
      expect(
        screen.getByText(spec("信じられない！　幻の　ミュウツーを　捕まえたぞ！")),
      ).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "捕獲に失敗していて、出題ポケモンが「ピカチュウ」のとき",
          When: [SHOW_RESULT],
          Then: "「野生の　ピカチュウは　逃げ出した！」と表示される",
        },
      ],
    },
    () => {
      renderCaptureResult(baseResult({ captured: false }));
      expect(screen.getByText(spec("野生の　ピカチュウは　逃げ出した！"))).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: "ポケモンのタイプがでんきのとき", When: [SHOW_RESULT], Then: "「でんき」と表示される" }],
    },
    () => {
      renderCaptureResult(baseResult());
      expect(screen.getByText("でんき")).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ When: ["捕獲結果画面で、「メニューに戻る」ボタンを押す"], Then: "ホーム画面が表示される" }],
    },
    async () => {
      const user = userEvent.setup();
      render(
        <MemoryRouter initialEntries={["/quest"]}>
          <Routes>
            <Route
              path="/quest"
              element={<CaptureResult result={baseResult()} onNewQuest={vi.fn()} />}
            />
            <Route path="/" element={<div data-testid="home-page" />} />
          </Routes>
        </MemoryRouter>,
      );

      await user.click(screen.getByRole("button", { name: "メニューに戻る" }));

      expect(screen.getByTestId("home-page")).toBeInTheDocument();
    },
  );
});
