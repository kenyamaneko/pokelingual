import { test, expect } from "@playwright/test";
import { completeTutorialViaApi, completeQuest, resetExcludedPokemon } from "./helpers";
import { PLACEHOLDER, TEXT } from "./labels";

test.skip(() => process.env.E2E_MODE === "dev", "mock-only spec");

test.beforeEach(async ({ page }) => {
  await completeTutorialViaApi(page);
  await resetExcludedPokemon(page);
});

test("苦手ポケモンとしてひらがな検索で除外すると、そのポケモンは出題されず、他のポケモンでクエストを完了できる", async ({ page }) => {
  await page.goto("/settings");
  await page.getByPlaceholder(PLACEHOLDER.pokemonSearch).fill("ぴかちゅう");
  await page.getByRole("button", { name: /ピカチュウ/ }).click();
  await expect(page.getByText("ピカチュウ")).toBeVisible();

  await completeQuest(page);

  await expect(page.getByText(TEXT.captured)).toBeVisible();
  await expect(page.getByTestId("captured-name-ja")).toHaveText("フシギダネ");
});
