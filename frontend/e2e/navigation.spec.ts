import { test, expect } from "@playwright/test";
import { completeTutorialViaApi } from "./helpers";
import { LINK, BUTTON } from "./labels";

// 認証バイパス済み（DevAuthProvider）の mock モード専用。dev では各ページが認証で保護される。
test.skip(() => process.env.E2E_MODE === "dev", "mock-only spec");

// このファイルは本番導線の配線を検証する。dev-user のチュートリアル完了状態を先に立てておく
test.beforeEach(async ({ page }) => {
  await completeTutorialViaApi(page);
});

test("ホームの各リンクから対応する画面へ移動できる", async ({ page }) => {
  await page.goto("/");

  // ぼうけんに出かける → /quest
  await page.getByRole("button", { name: BUTTON.startQuest }).click();
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

test("画面幅が広いとき、ヘッダーのナビゲーションはハンバーガーメニューにならない", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto("/");

  await expect(page.getByRole("button", { name: BUTTON.menu })).not.toBeVisible();
  await expect(page.getByRole("link", { name: LINK.navQuest, exact: true })).toBeVisible();
});

test("画面幅が狭いとき、ヘッダーのナビゲーションはハンバーガーメニューに折りたたまれる", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");

  const menuButton = page.getByRole("button", { name: BUTTON.menu });
  await expect(menuButton).toBeVisible();
  await expect(page.getByRole("link", { name: LINK.navQuest, exact: true })).not.toBeVisible();

  await menuButton.click();
  await page.getByRole("link", { name: LINK.navQuest, exact: true }).click();
  await expect(page).toHaveURL("/quest");
});
