import { test, expect } from "@playwright/test";
import { completeQuest } from "./helpers";
import { BUTTON, HEADING, LINK, TEXT } from "./labels";

// 固定ポケモン集合・即時採点を前提とする mock モード専用。dev は dev-quest-flow.spec.ts が担当。
test.skip(() => process.env.E2E_MODE === "dev", "mock-only spec");

test("ログインして図鑑を開くと、図鑑が表示される", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: LINK.viewPokedex }).click();
  await expect(page).toHaveURL("/pokedex");
  await expect(page.getByRole("heading", { name: HEADING.pokedex })).toBeVisible();
});

test("クエスト後の図鑑確認（カード表示 → 詳細モーダルの実績確認 → 閉じる）", async ({ page }) => {
  // クエストを1回完了（mock モードでは捕獲は決定的に成功する）
  await completeQuest(page);

  // 図鑑に移動
  await page.goto("/pokedex");

  // 捕獲したポケモン (mock は決定的にピカチュウ) のカードが表示されている
  const pokemonCard = page.getByTestId("pokemon-card").first();
  await expect(pokemonCard).toBeVisible();
  await expect(pokemonCard).toContainText("ピカチュウ");

  // カードをクリック → 詳細モーダル
  await pokemonCard.click();

  // 詳細モーダルが表示される
  await expect(page.getByText(TEXT.bestScore)).toBeVisible();
  await expect(page.getByText(TEXT.captureCount)).toBeVisible();

  // 閉じるボタンで閉じる
  await page.getByRole("button", { name: BUTTON.close }).click();
  await expect(page.getByText(TEXT.bestScore)).not.toBeVisible();
});
