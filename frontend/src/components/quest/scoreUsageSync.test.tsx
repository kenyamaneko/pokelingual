import { screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
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

describe("[本体:AI 呼び出し回数]残り回数の表示", () => {
  describe("部品間結合テスト", () => {
    describe("正常系", () => {
      it("ヘッダーに「残り 25/30」と表示されているとき、翻訳を送信して採点が成功すると、ヘッダーに「残り 24/30」と表示される", async () => {
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
      });
    });
  });
});
