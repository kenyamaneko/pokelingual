import { test, expect } from "@playwright/test";
import {
  completeTutorialViaApi,
  completeQuest,
  resetExcludedPokemon,
} from "./helpers";
import { PLACEHOLDER, TEXT } from "./labels";

test.skip(() => process.env.E2E_MODE === "dev", "mock-only spec");

test.describe("[本体:設定画面から捕獲結果画面]利用者設定を挟む動線", () => {
  test.describe("外部サービスをモックにした環境で、チュートリアルが完了済みで、除外ポケモンが未設定のとき", () => {
    test.beforeEach(async ({ page }) => {
      await completeTutorialViaApi(page);
      await resetExcludedPokemon(page);
    });

    test.describe("シナリオテスト", () => {
      test.describe("正常系", () => {
        test("設定画面で「ぴかちゅう」とひらがなで検索して検索結果の「ピカチュウ」を押すと、除外ポケモンの一覧に「ピカチュウ」が表示され、続けてクエストで「廃墟の発電所」を選び、翻訳「テスト翻訳」を送信し、名前当てをスキップしてボールを使うと、「捕まえたぞ」と表示され、捕まえたポケモンの日本語名は「フシギダネ」になる", async ({
          page,
        }) => {
          await page.goto("/settings");
          await page
            .getByPlaceholder(PLACEHOLDER.pokemonSearch)
            .fill("ぴかちゅう");
          await page.getByRole("button", { name: /ピカチュウ/ }).click();
          const excludedPokemon = page
            .getByRole("listitem")
            .filter({ has: page.getByRole("button", { name: "削除" }) });
          await expect(excludedPokemon).toHaveCount(1);
          await expect(excludedPokemon).toContainText("ピカチュウ");

          await completeQuest(page);

          await expect(page.getByText(TEXT.captured)).toBeVisible();
          await expect(page.getByTestId("captured-name-ja")).toHaveText(
            "フシギダネ",
          );
        });
      });
    });
  });
});
