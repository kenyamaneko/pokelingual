import { test, expect } from "@playwright/test";
import { completeQuest } from "./helpers";
import { BUTTON, HEADING, LINK, TEXT } from "./labels";

// 固定ポケモン集合・即時採点を前提とする mock モード専用。dev は dev-signup-flow.spec.ts が担当。
test.skip(() => process.env.E2E_MODE === "dev", "mock-only spec");

test("図鑑ページが表示される", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: LINK.viewCollection }).click();
  await expect(page).toHaveURL("/collection");
  await expect(page.getByRole("heading", { name: HEADING.collection })).toBeVisible();
});

test("クエスト後に捕獲ポケモンが図鑑に表示される", async ({ page }) => {
  // クエストを1回完了（mock モードでは捕獲は決定的に成功する）
  await completeQuest(page);

  // 図鑑に移動
  await page.goto("/collection");

  // ポケモンカードが表示されている
  const pokemonCard = page.getByTestId("pokemon-card").first();
  await expect(pokemonCard).toBeVisible();

  // カードをクリック → 詳細モーダル
  await pokemonCard.click();

  // 詳細モーダルが表示される
  await expect(page.getByText(TEXT.bestScore)).toBeVisible();
  await expect(page.getByText(TEXT.captureCount)).toBeVisible();

  // 閉じるボタンで閉じる
  await page.getByRole("button", { name: BUTTON.close }).click();
  await expect(page.getByText(TEXT.bestScore)).not.toBeVisible();
});
