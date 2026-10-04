import { test, expect } from "@playwright/test";
import { completeTutorialViaApi, completeQuest, resetExcludedPokemon } from "./helpers";
import { PLACEHOLDER, TEXT } from "./labels";

test.skip(() => process.env.E2E_MODE === "dev", "mock-only spec");

test.beforeEach(async ({ page }) => {
  await completeTutorialViaApi(page);
  await resetExcludedPokemon(page);
});

test.describe("苦手ポケモン設定", () => {
  test.describe("正常系", () => {
    test("mock モードで苦手ポケモンが未設定のとき、設定画面で「ぴかちゅう」とひらがなで検索して検索結果の「ピカチュウ」を押すと、苦手ポケモンの一覧に「ピカチュウ」が表示され、続けてクエストを完了すると、捕まえたポケモンの日本語名は「ピカチュウ」以外になる", async ({
      page,
    }) => {
      await page.goto("/settings");
      await page.getByPlaceholder(PLACEHOLDER.pokemonSearch).fill("ぴかちゅう");
      await page.getByRole("button", { name: /ピカチュウ/ }).click();
      await expect(page.getByText("ピカチュウ")).toBeVisible();

      await completeQuest(page);

      await expect(page.getByText(TEXT.captured)).toBeVisible();
      await expect(page.getByTestId("captured-name-ja")).toHaveText("フシギダネ");
    });
  });
});
