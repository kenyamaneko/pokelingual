import { test, expect } from "@playwright/test";
import { resetExcludedPokemon } from "./helpers";
import { PLACEHOLDER } from "./labels";

// 固定ポケモン集合を前提とする mock モード専用。
test.skip(() => process.env.E2E_MODE === "dev", "mock-only spec");

test.beforeEach(async ({ page }) => {
  await resetExcludedPokemon(page);
});

test("ひらがなで検索して未遭遇のポケモンを選ぶと、苦手ポケモン一覧に反映される", async ({ page }) => {
  await page.goto("/settings");

  await page.getByPlaceholder(PLACEHOLDER.pokemonSearch).fill("ふしぎだね");
  await page.getByRole("button", { name: /フシギダネ/ }).click();

  await expect(page.getByText("フシギダネ")).toBeVisible();
});
