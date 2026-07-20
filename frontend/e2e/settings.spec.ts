import { test, expect } from "@playwright/test";
import { completeTutorialViaApi, completeQuest, resetExcludedPokemon } from "./helpers";
import { PLACEHOLDER, TEXT } from "./labels";

// 廃墟の発電所はどくタイプも対象のため、フシギダネを除外するとピカチュウが確定的に出題される。
test.skip(() => process.env.E2E_MODE === "dev", "mock-only spec");

test.beforeEach(async ({ page }) => {
  await completeTutorialViaApi(page);
  await resetExcludedPokemon(page);
});

test("苦手ポケモンとしてひらがな検索で除外すると、そのポケモンは出題されず、他のポケモンでクエストを完了できる", async ({ page }) => {
  await page.goto("/settings");
  await page.getByPlaceholder(PLACEHOLDER.pokemonSearch).fill("ふしぎだね");
  await page.getByRole("button", { name: /フシギダネ/ }).click();
  await expect(page.getByText("フシギダネ")).toBeVisible();

  await completeQuest(page);

  await expect(page.getByText(TEXT.captured)).toBeVisible();
  await expect(page.getByTestId("captured-name-ja")).toHaveText("ピカチュウ");
});
