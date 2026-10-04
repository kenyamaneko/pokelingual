import { test, expect } from "@playwright/test";
import { completeQuest } from "./helpers";
import { BUTTON, HEADING, LINK, TEXT } from "./labels";

// dev は固定のポケモン集合も即時の採点も前提にできないため、mock モード専用にする。
test.skip(() => process.env.E2E_MODE === "dev", "mock-only spec");

test.describe("図鑑", () => {
  test.describe("正常系", () => {
    test("ホーム画面の「図鑑を見る」を押すと、図鑑画面に遷移し、見出し「図鑑」が表示される", async ({ page }) => {
      await page.goto("/");
      await page.getByRole("link", { name: LINK.viewPokedex }).click();
      await expect(page).toHaveURL("/pokedex");
      await expect(page.getByRole("heading", { name: HEADING.pokedex })).toBeVisible();
    });

    test("mock モードでクエストを完了してポケモンを捕まえたあと、図鑑画面を開くと、捕まえたポケモンの日本語名のカードが表示され、カードを押すと詳細モーダルに「最高スコア」と「捕獲回数」が表示され、「閉じる」を押すと「最高スコア」の表示が消える", async ({
      page,
    }) => {
      await completeQuest(page);

      await page.goto("/pokedex");

      const pokemonCard = page.getByTestId("pokemon-card").first();
      await expect(pokemonCard).toBeVisible();
      await expect(pokemonCard).toContainText("ピカチュウ");

      await pokemonCard.click();

      await expect(page.getByText(TEXT.bestScore)).toBeVisible();
      await expect(page.getByText(TEXT.captureCount)).toBeVisible();

      await page.getByRole("button", { name: BUTTON.close }).click();
      await expect(page.getByText(TEXT.bestScore)).not.toBeVisible();
    });
  });
});
