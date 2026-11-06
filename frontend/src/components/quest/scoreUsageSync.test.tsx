import { screen } from "@testing-library/react";
import { describe, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { QuestPage } from "../../pages/QuestPage";
import { Header } from "../layout/Header";
import { renderWithProviders } from "../../test/render";
import { server, apiUrl } from "../../test/mswServer";
import {
  DAILY_LIMIT,
  fakeUser,
  createUsageHandler,
  submitTranslationForScoring,
} from "../../test/scoringFlow";
import { defineCase } from "../../test/defineCase";

const OPEN_QUEST_SCREEN = "クエスト画面を開く";
const SUBMIT_TRANSLATION_FOR_SCORING = [
  "場所選択画面で「木漏れ日の森」を選ぶ",
  "クエスト画面の翻訳の入力欄に「この ポケモンは はやい」と入力する",
  "クエスト画面の翻訳の入力欄で、「この翻訳に決めた！」ボタンを押す",
] as const;

describe("[本体:AI 呼び出し回数]残り回数の表示", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "ヘッダーに「残り 25/30」と表示されているとき",
          When: [OPEN_QUEST_SCREEN, ...SUBMIT_TRANSLATION_FOR_SCORING],
          Then: "ヘッダーに「残り 24/30」と表示される",
        },
      ],
    },
    async () => {
      server.use(
        createUsageHandler([
          { count: 5, limit: DAILY_LIMIT },
          { count: 6, limit: DAILY_LIMIT },
        ]),
        http.post(apiUrl("/quest/score"), () =>
          HttpResponse.json({ score: 80, review: "雷の嵐という訳がよくできている。集まるの意味も正しく伝わっている。", description_ja: "何匹か　あつまっていると そこでは　強い　電気が　たまり 雷が　落ちることが　あるという。" }),
        ),
      );
      renderWithProviders(
        <>
          <Header />
          <QuestPage />
        </>,
        { user: fakeUser, withRouter: true },
      );
      expect(await screen.findByText("残り 25/30")).toBeInTheDocument();

      await submitTranslationForScoring();

      expect(await screen.findByText("残り 24/30")).toBeInTheDocument();
    },
  );
});
