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

describe("[本体:AI 呼び出し回数]残り回数の表示", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "ヘッダーに「残り 25/30」と表示されていて、バックエンドが採点に成功するとき",
          When: ["クエスト画面で、場所「テスト草原」を選び、翻訳を入力して「この翻訳に決めた！」を押し、AI に採点を依頼する"],
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
          HttpResponse.json({ score: 80, review: "よい", description_ja: "テストの せつめい" }),
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
