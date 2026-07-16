import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import type { User } from "firebase/auth";
import { QuestPage } from "../../pages/QuestPage";
import { TRANSLATION_INPUT_LABELS } from "./TranslationInput";
import { Header } from "../layout/Header";
import { renderWithProviders } from "../../test/render";
import { server, apiUrl } from "../../test/mswServer";
import type { DailyUsage } from "../../../../shared/api-types/usage";

/**
 * 429 到達時の残量同期は rateLimitFlow.test.tsx が別トリガー (rateLimitEvents) の
 * 経路として確かめ済みのため、本ファイルでは対象外とする。
 */

const DAILY_LIMIT = 30;
const fakeUser = { uid: "trainer-test" } as unknown as User;
const TRANSLATION_TEXT = "この ポケモンは はやい";

// GET /usage は冪等なため、応答列を使い切ったら末尾を返し続けてよい。
function setupScoreSuccess(usageResponses: DailyUsage[]): void {
  let usageCallCount = 0;
  server.use(
    http.get(apiUrl("/usage"), () => {
      const index = Math.min(usageCallCount, usageResponses.length - 1);
      usageCallCount += 1;
      return HttpResponse.json(usageResponses[index]);
    }),
    http.post(apiUrl("/quest/score"), () =>
      HttpResponse.json({ score: 80, review: "よい", description_ja: "テストの せつめい" }),
    ),
  );
}

describe("採点成功時の残量同期 (採点送信 → ヘッダー表示の更新)", () => {
  it("残り 25/30 の表示中に採点が成功すると、ヘッダーの表示が残り 24/30 に変わる", async () => {
    setupScoreSuccess([
      { count: 5, limit: DAILY_LIMIT },
      { count: 6, limit: DAILY_LIMIT },
    ]);
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <Header />
        <QuestPage />
      </>,
      { user: fakeUser, withRouter: true },
    );
    expect(await screen.findByText(`残り 25/${DAILY_LIMIT}`)).toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: /テスト草原/ }));
    await user.type(await screen.findByRole("textbox"), TRANSLATION_TEXT);
    await user.click(
      screen.getByRole("button", { name: TRANSLATION_INPUT_LABELS.submitButton }),
    );

    expect(await screen.findByText(`残り 24/${DAILY_LIMIT}`)).toBeInTheDocument();
  });
});
