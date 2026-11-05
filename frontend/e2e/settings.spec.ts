import { test, expect } from "@playwright/test";
import {
  completeTutorialViaApi,
  completeQuest,
  resetExcludedPokemon,
} from "./helpers";
import { PLACEHOLDER, TEXT } from "./labels";
import { defineCase } from "./defineCase";

test.skip(() => process.env.E2E_MODE === "dev", "mock-only spec");

test.describe("[シナリオ:ポケモンを捕まえる:利用者設定を挟む動線]設定画面から捕獲結果画面", () => {
  test.beforeEach(async ({ page }) => {
    await completeTutorialViaApi(page);
    await resetExcludedPokemon(page);
  });

  defineCase(
    {
      種別: "シナリオテスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "外部サービスをモックにした環境で、チュートリアルが完了済みで、除外ポケモンが未設定のとき",
          When: [
            "設定画面を開く",
            "「ぴかちゅう」とひらがなで検索する",
            "検索結果の「ピカチュウ」を押す",
          ],
          Then: "除外ポケモンの一覧に「ピカチュウ」が 1 件表示される",
        },
        {
          When: [
            "クエスト画面を開く",
            "場所「廃墟の発電所」を選ぶ",
            "翻訳「テスト翻訳」を送信する",
            "名前当てをスキップする",
            "ボールを使う",
          ],
          Then: "「捕まえたぞ」と表示され、捕まえたポケモンの日本語名は「フシギダネ」になる",
        },
      ],
    },
    async ({ page }) => {
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
    },
  );
});
