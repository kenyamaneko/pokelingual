import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import type { User } from "firebase/auth";
import { QuestPage } from "../../pages/QuestPage";
import { TRANSLATION_INPUT_LABELS } from "./TranslationInput";
import { RATE_LIMIT_LABELS } from "./RateLimitModal";
import { Header } from "../layout/Header";
import { renderWithProviders } from "../../test/render";
import { server, apiUrl } from "../../test/mswServer";
import { spec } from "../../test/labels";
import type { DailyUsage } from "../../../../shared/api-types/usage";

/**
 * 429 レート制限の結合仕様 (一気通貫):
 * ユーザ操作 (翻訳の採点送信) → 実 axios クライアントのインターセプタ → rateLimitEvents
 * → UsageProvider → RateLimitModal 表示・ヘッダー残量同期までを、HTTP 境界 (MSW) だけ
 * 差し替えて確かめる。QuestPage / questApi / usageApi / Provider / モーダル / Header は本物を通す。
 *
 * イベント受信 → モーダル表示・残量同期の検証は本ファイルが唯一の置き場 (公開入口からの
 * 一気通貫のみを正とし、イベント手動発火による途中割り込みは行わない)。
 * kind (user/global) 別のタイトル出し分けは RateLimitModal 単体で網羅済みのため、本結合では
 * user のみで経路を確かめる。
 */

const RATE_LIMIT_MESSAGE = "きょうの　じょうげんに　たっしました";
const DAILY_LIMIT = 30;
const USAGE_AT_LIMIT: DailyUsage = { count: DAILY_LIMIT, limit: DAILY_LIMIT };

/**
 * /quest/score に 429 を返し、/usage は与えた応答列を呼び出し順に返す HTTP 境界を設定する。
 * @param usageResponses /usage の呼び出し順に返す利用状況。使い切ったら末尾を返し続ける (GET /usage は冪等)。
 */
function setupRateLimited(usageResponses: DailyUsage[]): void {
  let usageCallCount = 0;
  server.use(
    http.get(apiUrl("/usage"), () => {
      const index = Math.min(usageCallCount, usageResponses.length - 1);
      usageCallCount += 1;
      return HttpResponse.json(usageResponses[index]);
    }),
    http.post(apiUrl("/quest/score"), () =>
      HttpResponse.json({ error: "user", message: RATE_LIMIT_MESSAGE }, { status: 429 }),
    ),
  );
}

const fakeUser = { uid: "trainer-test" } as unknown as User;

const TRANSLATION_TEXT = "この ポケモンは はやい";

/**
 * 出題の読み込みを待ち、翻訳を入力して採点へ送信する。
 * @returns 送信操作の完了後に解決する Promise。
 */
async function submitTranslationForScoring(): Promise<void> {
  const user = userEvent.setup();
  await user.type(await screen.findByRole("textbox"), TRANSLATION_TEXT);
  await user.click(
    screen.getByRole("button", { name: TRANSLATION_INPUT_LABELS.submitButton }),
  );
}

describe("429 レート制限の結合仕様 (採点送信 → モーダル表示・残量同期)", () => {
  it("採点送信が 429 に到達すると、上限モーダルが表示される", async () => {
    setupRateLimited([USAGE_AT_LIMIT]);
    renderWithProviders(<QuestPage />, { user: fakeUser, withRouter: true });

    await submitTranslationForScoring();

    // タイトルとバックエンド由来のメッセージが画面に出るところまで確かめる
    expect(await screen.findByText(spec(RATE_LIMIT_LABELS.userTitle))).toBeInTheDocument();
    expect(screen.getByText(spec(RATE_LIMIT_MESSAGE))).toBeInTheDocument();
  });

  it("429 の後、ヘッダーの残量表示が最新の利用状況に同期する", async () => {
    setupRateLimited([{ count: DAILY_LIMIT - 1, limit: DAILY_LIMIT }, USAGE_AT_LIMIT]);
    // Header が useLocation を使うため Router を被せる
    renderWithProviders(
      <>
        <Header />
        <QuestPage />
      </>,
      { user: fakeUser, withRouter: true },
    );
    expect(await screen.findByText(`のこり 1/${DAILY_LIMIT}`)).toBeInTheDocument();

    await submitTranslationForScoring();

    expect(await screen.findByText(`のこり 0/${DAILY_LIMIT}`)).toBeInTheDocument();
  });
});
