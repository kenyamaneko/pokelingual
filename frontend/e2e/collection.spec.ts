import { test, expect } from "@playwright/test";
import { completeQuest } from "./helpers";

test("図鑑ページが表示される", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /ずかんを\u3000見る/ }).click();
  await expect(page).toHaveURL("/collection");
  await expect(page.getByText("ずかん")).toBeVisible();
});

test("クエスト後に捕獲ポケモンが図鑑に表示される", async ({ page }) => {
  // クエストを1回完了
  await completeQuest(page);

  // 図鑑に移動
  await page.goto("/collection");

  // ポケモンの画像が表示されている
  const pokemonImages = page.locator("img[alt]").first();
  await expect(pokemonImages).toBeVisible();

  // カードをクリック → 詳細モーダル
  await pokemonImages.click();

  // 詳細モーダルが表示される
  await expect(page.getByText("さいこう\u3000スコア")).toBeVisible();
  await expect(page.getByText("ほかく\u3000回数")).toBeVisible();

  // 閉じるボタンで閉じる
  await page.getByRole("button", { name: "とじる" }).click();
  await expect(page.getByText("さいこう\u3000スコア")).not.toBeVisible();
});
