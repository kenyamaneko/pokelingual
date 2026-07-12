import type { Page } from "@playwright/test";
import { BUTTON, PLACEHOLDER, TEXT } from "./labels";

// /signup から新規登録し、認証済みでホームに着地するまでを行う。dev モードの E2E で使う。
export async function registerViaUi(page: Page, email: string, password: string) {
  await page.goto("/signup");
  await page.getByTestId("signup-email").fill(email);
  await page.getByTestId("signup-password").fill(password);
  await page.getByTestId("signup-password-confirm").fill(password);
  await page.getByTestId("signup-submit").click();
  // 登録成功で onAuthStateChanged が発火し、ホームへリダイレクトされる
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

// クエストを1回完走させる（翻訳→採点→名前スキップ→捕獲→結果カード表示まで）。
export async function completeQuest(page: Page) {
  await page.goto("/quest");
  // 場所選択で「廃墟の発電所」(でんき) を選ぶと、mock では決定的にピカチュウが出る
  await page.getByRole("button", { name: BUTTON.selectPowerPlant }).click();
  await page.getByText(TEXT.questTitle).waitFor();

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
