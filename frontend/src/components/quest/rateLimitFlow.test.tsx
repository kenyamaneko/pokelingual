import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { QuestPage } from "../../pages/QuestPage";
import { Header } from "../layout/Header";
import { renderWithProviders } from "../../test/render";
import { server, apiUrl } from "../../test/mswServer";
import { spec } from "../../test/labels";
import { defineCase } from "../../test/defineCase";
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
 * 採点の送信に日次上限の拒否を返し、AI 呼び出し回数は与えた応答列を呼び出し順に返す HTTP 境界を設定する。
 * @param usageResponses AI 呼び出し回数の取得で呼び出し順に返す応答。
 */
function setupRateLimited(usageResponses: DailyUsage[]): void {
  server.use(
    createUsageHandler(usageResponses),
    http.post(apiUrl("/quest/score"), () =>
      HttpResponse.json({ error: "user", message: RATE_LIMIT_MESSAGE }, { status: 429 }),
    ),
  );
}

const USAGE_AT_LIMIT_GIVEN = "ユーザーの AI 呼び出し回数が日次上限の 30 回に達しているとき";
const MODAL_SHOWN_GIVEN = "ユーザーの AI 呼び出し回数が日次上限の 30 回に達して、日次上限モーダルが表示されているとき";
const SUBMIT_TRANSLATION = "翻訳を送信する";

describe("[本体:AI 呼び出し回数]日次上限の表示", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: USAGE_AT_LIMIT_GIVEN,
          When: [SUBMIT_TRANSLATION],
          Then: "日次上限モーダルのタイトルに「博士は忙しそうにしている」が表示される",
        },
      ],
    },
    async () => {
      setupRateLimited([USAGE_AT_LIMIT]);
      renderWithProviders(<QuestPage />, { user: fakeUser, withRouter: true });

      await submitTranslationForScoring();

      expect(await screen.findByText(spec("博士は忙しそうにしている"))).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: "ユーザーの AI 呼び出し回数が日次上限の 30 回に達していて、バックエンドが日次上限を知らせるメッセージ「きょうの　じょうげんに　たっしました」を返したとき",
          When: [SUBMIT_TRANSLATION],
          Then: "日次上限モーダルに「きょうの　じょうげんに　たっしました」と表示される",
        },
      ],
    },
    async () => {
      setupRateLimited([USAGE_AT_LIMIT]);
      renderWithProviders(<QuestPage />, { user: fakeUser, withRouter: true });

      await submitTranslationForScoring();

      expect(await screen.findByText(spec(RATE_LIMIT_MESSAGE))).toBeInTheDocument();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: "ヘッダーに「残り 1/30」と表示されていて、翻訳の送信で日次上限に達するとき",
          When: [SUBMIT_TRANSLATION],
          Then: "ヘッダーに「残り 0/30」と表示される",
        },
      ],
    },
    async () => {
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
    },
  );
});

/**
 * 採点の送信を日次上限に到達させ、日次上限モーダルが表示された状態まで進める。
 */
async function showRateLimitModal(): Promise<void> {
  setupRateLimited([USAGE_AT_LIMIT]);
  renderWithProviders(<QuestPage />, { user: fakeUser, withRouter: true });
  await submitTranslationForScoring();
  await screen.findByText(spec("博士は忙しそうにしている"));
}

describe("[本体:AI 呼び出し回数]日次上限モーダルの閉じ方", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: MODAL_SHOWN_GIVEN,
          When: ["「閉じる」ボタンを押す"],
          Then: "日次上限モーダルが画面から消える",
        },
      ],
    },
    async () => {
      const user = userEvent.setup();
      await showRateLimitModal();

      await user.click(screen.getByRole("button", { name: "閉じる" }));

      await waitFor(() =>
        expect(screen.queryByText(spec("博士は忙しそうにしている"))).not.toBeInTheDocument(),
      );
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: MODAL_SHOWN_GIVEN,
          When: ["モーダルの外側をクリックする"],
          Then: "日次上限モーダルが画面から消える",
        },
      ],
    },
    async () => {
      const user = userEvent.setup();
      await showRateLimitModal();

      await user.click(screen.getByTestId("rate-limit-backdrop"));

      await waitFor(() =>
        expect(screen.queryByText(spec("博士は忙しそうにしている"))).not.toBeInTheDocument(),
      );
    },
  );
});
