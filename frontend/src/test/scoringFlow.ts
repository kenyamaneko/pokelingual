import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { User } from "firebase/auth";
import { apiUrl } from "./mswServer";
import type { DailyUsage } from "../../../shared/api-types/usage";

export const DAILY_LIMIT = 30;

export const fakeUser = { uid: "trainer-test" } as unknown as User;

const TRANSLATION_TEXT = "この ポケモンは はやい";

/**
 * 利用状況の取得に、与えた応答列を呼び出し順に返す HTTP ハンドラを作る。
 * 利用状況の取得は何度呼んでも結果が変わらないため、応答列を使い切ったら末尾の応答を返し続ける。
 * @param usageResponses 呼び出し順に返す利用状況。
 * @returns MSW のハンドラ。
 */
export function createUsageHandler(usageResponses: DailyUsage[]) {
  let usageCallCount = 0;
  return http.get(apiUrl("/usage"), () => {
    const index = Math.min(usageCallCount, usageResponses.length - 1);
    usageCallCount += 1;
    return HttpResponse.json(usageResponses[index]);
  });
}

/** 出題の読み込みを待ち、翻訳を入力して採点へ送信する。 */
export async function submitTranslationForScoring(): Promise<void> {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: /テスト草原/ }));
  await user.type(await screen.findByRole("textbox"), TRANSLATION_TEXT);
  await user.click(screen.getByRole("button", { name: "この翻訳に決めた！" }));
}
