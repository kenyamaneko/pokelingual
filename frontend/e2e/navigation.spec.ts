import { test, expect } from "@playwright/test";

test("ホームページのリンクが全て機能する", async ({ page }) => {
  await page.goto("/");

  // ぼうけんに出かける → /quest
  await page.getByRole("link", { name: /ぼうけんに\u3000出かける/ }).click();
  await expect(page).toHaveURL("/quest");

  // ヘッダーロゴ → /
  await page.getByRole("link", { name: "PokeLingual" }).click();
  await expect(page).toHaveURL("/");

  // ずかんを見る → /collection
  await page.getByRole("link", { name: /ずかんを\u3000見る/ }).click();
  await expect(page).toHaveURL("/collection");

  // ヘッダーロゴ → /
  await page.getByRole("link", { name: "PokeLingual" }).click();
  await expect(page).toHaveURL("/");

  // せってい → /settings
  await page.getByRole("link", { name: "せってい" }).first().click();
  await expect(page).toHaveURL("/settings");
});

test("ヘッダーナビゲーション", async ({ page }) => {
  await page.goto("/");

  // ヘッダーの「ぼうけん」リンク
  await page.getByRole("link", { name: "ぼうけん" }).click();
  await expect(page).toHaveURL("/quest");

  // ヘッダーの「ずかん」リンク
  await page.getByRole("link", { name: "ずかん" }).click();
  await expect(page).toHaveURL("/collection");

  // ヘッダーの「せってい」リンク
  await page.getByRole("link", { name: "せってい" }).click();
  await expect(page).toHaveURL("/settings");
});
