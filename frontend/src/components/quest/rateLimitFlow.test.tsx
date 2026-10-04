import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { QuestPage } from "../../pages/QuestPage";
import { Header } from "../layout/Header";
import { renderWithProviders } from "../../test/render";
import { server, apiUrl } from "../../test/mswServer";
import { spec } from "../../test/labels";
import {
  DAILY_LIMIT,
  fakeUser,
  createUsageHandler,
  submitTranslationForScoring,
} from "../../test/scoringFlow";
import type { DailyUsage } from "../../../../shared/api-types/usage";

const RATE_LIMIT_MESSAGE = "きょうの　じょうげんに　たっしました";
const USAGE_AT_LIMIT: DailyUsage = { count: DAILY_LIMIT, limit: DAILY_LIMIT };

/**
 * 採点の送信に利用上限の拒否を返し、利用状況は与えた応答列を呼び出し順に返す HTTP 境界を設定する。
 * @param usageResponses 利用状況の取得で呼び出し順に返す応答。
 */
function setupRateLimited(usageResponses: DailyUsage[]): void {
  server.use(
    createUsageHandler(usageResponses),
    http.post(apiUrl("/quest/score"), () =>
      HttpResponse.json({ error: "user", message: RATE_LIMIT_MESSAGE }, { status: 429 }),
    ),
  );
}

describe("[レート制限・利用回数] 利用上限の表示", () => {
  describe("異常系", () => {
    describe("採点の送信で利用上限に達したとき", () => {
      it("自分の利用上限のとき、利用上限モーダルに「博士は忙しそうにしている」と表示される", async () => {
        setupRateLimited([USAGE_AT_LIMIT]);
        renderWithProviders(<QuestPage />, { user: fakeUser, withRouter: true });

        await submitTranslationForScoring();

        expect(await screen.findByText(spec("博士は忙しそうにしている"))).toBeInTheDocument();
      });

      it("利用上限モーダルに、サーバーから返されたメッセージが表示される", async () => {
        setupRateLimited([USAGE_AT_LIMIT]);
        renderWithProviders(<QuestPage />, { user: fakeUser, withRouter: true });

        await submitTranslationForScoring();

        expect(await screen.findByText(spec(RATE_LIMIT_MESSAGE))).toBeInTheDocument();
      });
    });

    it("ヘッダーに「残り 1/30」と表示されているとき、採点の送信で利用上限に達すると、ヘッダーの表示が「残り 0/30」に変わる", async () => {
      setupRateLimited([{ count: DAILY_LIMIT - 1, limit: DAILY_LIMIT }, USAGE_AT_LIMIT]);
      // ヘッダーは現在のページの位置を使うため、Router を被せる
      renderWithProviders(
        <>
          <Header />
          <QuestPage />
        </>,
        { user: fakeUser, withRouter: true },
      );
      expect(await screen.findByText("残り 1/30")).toBeInTheDocument();

      await submitTranslationForScoring();

      expect(await screen.findByText("残り 0/30")).toBeInTheDocument();
    });
  });
});

/**
 * 採点の送信を利用上限に到達させ、利用上限モーダルが表示された状態まで進める。
 */
async function showRateLimitModal(): Promise<void> {
  setupRateLimited([USAGE_AT_LIMIT]);
  renderWithProviders(<QuestPage />, { user: fakeUser, withRouter: true });
  await submitTranslationForScoring();
  await screen.findByText(spec("博士は忙しそうにしている"));
}

describe("[レート制限・利用回数] 利用上限モーダルの閉じ方", () => {
  describe("異常系", () => {
    describe("利用上限モーダルが表示されているとき", () => {
      it("「閉じる」ボタンを押すと、利用上限モーダルが画面から消える", async () => {
        const user = userEvent.setup();
        await showRateLimitModal();

        await user.click(screen.getByRole("button", { name: "閉じる" }));

        await waitFor(() =>
          expect(screen.queryByText(spec("博士は忙しそうにしている"))).not.toBeInTheDocument(),
        );
      });

      it("モーダルの外側をクリックすると、利用上限モーダルが画面から消える", async () => {
        const user = userEvent.setup();
        await showRateLimitModal();

        await user.click(screen.getByTestId("rate-limit-backdrop"));

        await waitFor(() =>
          expect(screen.queryByText(spec("博士は忙しそうにしている"))).not.toBeInTheDocument(),
        );
      });
    });
  });
});
