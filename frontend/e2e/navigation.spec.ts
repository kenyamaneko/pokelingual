import { test, expect } from "@playwright/test";
import { completeTutorialViaApi } from "./helpers";
import { LINK } from "./labels";

// 認証バイパス済み（DevAuthProvider）の mock モード専用。dev では各ページが認証で保護される。
test.skip(() => process.env.E2E_MODE === "dev", "mock-only spec");

// このファイルは本番導線の配線を検証する。dev-user のチュートリアル完了状態を先に立てておく
test.beforeEach(async ({ page }) => {
  await completeTutorialViaApi(page);
});

test("ホームページのリンクが全て機能する", async ({ page }) => {
  await page.goto("/");

  // ぼうけんに出かける → /quest
  await page.getByRole("link", { name: LINK.startQuest }).click();
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

test("ヘッダーナビゲーション", async ({ page }) => {
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
