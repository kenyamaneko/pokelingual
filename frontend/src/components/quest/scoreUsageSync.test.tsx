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

describe("[レート制限・利用回数] 残り回数の表示", () => {
  describe("正常系", () => {
    it("ヘッダーに「残り 25/30」と表示されているとき、採点の送信が成功すると、ヘッダーの表示が「残り 24/30」に変わる", async () => {
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
