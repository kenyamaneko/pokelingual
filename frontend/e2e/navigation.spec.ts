import { test, expect } from "@playwright/test";
import { completeTutorialViaApi } from "./helpers";
import { LINK } from "./labels";

// 認証バイパス済み（DevAuthProvider）の mock モード専用。dev では各ページが認証で保護される。
test.skip(() => process.env.E2E_MODE === "dev", "mock-only spec");

// このファイルは本番導線の配線を検証する。dev-user のチュートリアル完了状態を先に立てておく
test.beforeEach(async ({ page }) => {
  await completeTutorialViaApi(page);
});

test("ホームの各リンクから対応する画面へ移動できる", async ({ page }) => {
  await page.goto("/");

  // ぼうけんに出かける → /quest
  // (完了記録の反映は非同期のため、href の反映を待ってからクリックする)
  const startQuestLink = page.getByRole("link", { name: LINK.startQuest });
  await expect(startQuestLink).toHaveAttribute("href", "/quest");
  await startQuestLink.click();
  await expect(page).toHaveURL("/quest");

  // ヘッダーロゴ → /
  await page.getByRole("link", { name: LINK.logo }).click();
  await expect(page).toHaveURL("/");

  // ずかんを見る → /pokedex
  await page.getByRole("link", { name: LINK.viewPokedex }).click();
  await expect(page).toHaveURL("/pokedex");

  // ヘッダーロゴ → /
  await page.getByRole("link", { name: LINK.logo }).click();
  await expect(page).toHaveURL("/");

  // せってい → /settings
  await page.getByRole("link", { name: LINK.settings }).first().click();
  await expect(page).toHaveURL("/settings");
});

test("ヘッダーのリンクからクエスト・図鑑・設定へ移動できる", async ({ page }) => {
  await page.goto("/");

  // ヘッダーの「ぼうけん」リンク
  await page.getByRole("link", { name: LINK.navQuest, exact: true }).click();
  await expect(page).toHaveURL("/quest");

  // ヘッダーの「ずかん」リンク
  await page.getByRole("link", { name: LINK.navPokedex, exact: true }).click();
  await expect(page).toHaveURL("/pokedex");

  // ヘッダーの「せってい」リンク
  await page.getByRole("link", { name: LINK.settings, exact: true }).click();
  await expect(page).toHaveURL("/settings");
});
