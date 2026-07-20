import type { Page } from "@playwright/test";
import { BUTTON, PLACEHOLDER, TEXT } from "./labels";

/**
 * /login からメール確認済みユーザでログインし、ホームに着地するまでを行う。dev モードの E2E で使う。
 * @param page Playwright の Page。
 * @param email ログインに使うメールアドレス。
 * @param password ログインに使うパスワード。
 */
export async function loginViaUi(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByPlaceholder(PLACEHOLDER.email).fill(email);
  await page.getByPlaceholder(PLACEHOLDER.password).fill(password);
  await page.getByRole("button", { name: BUTTON.login }).click();
  await page.waitForURL("/");
}

const LOCAL_BACKEND_URL = "http://localhost:15100";

/**
 * backend の mock 認証は全リクエストが同一 uid (dev-user) に固定されるため、
 * 対象ユーザーを指定せず直接チュートリアル完了状態を立てる。local (mock) 専用。
 * @param page APIRequestContext を共有する Playwright の Page。
 */
export async function completeTutorialViaApi(page: Page) {
  await page.request.put(`${LOCAL_BACKEND_URL}/api/tutorial-status/complete`);
}

/**
 * 苦手ポケモン設定を空にリセットする。local (mock) 専用。
 * dev-user の状態が実行間で残るため、テストの再実行を独立させるために使う。
 * @param page APIRequestContext を共有する Playwright の Page。
 */
export async function resetExcludedPokemon(page: Page) {
  await page.request.put(`${LOCAL_BACKEND_URL}/api/settings/excluded-pokemon`, {
    data: { pokemon_ids: [] },
  });
}

// クエストを1回完走させる（翻訳→採点→名前スキップ→捕獲→結果カード表示まで）。
export async function completeQuest(page: Page) {
  await page.goto("/quest");
  // 場所選択で「廃墟の発電所」(でんき) を選ぶと、mock では決定的にピカチュウが出る
  await page.getByRole("button", { name: BUTTON.selectPowerPlant }).click();
  await page.getByTestId("quest-description").waitFor();

  // 翻訳入力 → 送信
  await page.getByPlaceholder(PLACEHOLDER.translation).fill("テスト翻訳");
  await page.getByRole("button", { name: BUTTON.submitTranslation }).click();

  // スコア表示待ち → 名前スキップ
  await page.getByText(TEXT.damage).waitFor();
  await page.getByRole("button", { name: BUTTON.skip }).click();

  // ボール使用
  await page.getByRole("button", { name: BUTTON.useBall }).click();

  // 結果表示待ち
  await page.getByRole("button", { name: BUTTON.nextQuest }).waitFor();
}
