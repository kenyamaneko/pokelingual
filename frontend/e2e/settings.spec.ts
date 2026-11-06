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
      環境: ["ローカル"],
      steps: [
        {
          Given: "ログインしていて、チュートリアルが完了済みで、除外ポケモンが未設定であるとき",
          When: [
            "設定画面を開く",
            "設定画面の除外ポケモンの検索で、「ポケモンの名前で探す」欄に「ぴかちゅう」と入力する",
            "設定画面の除外ポケモンの検索で、検索結果の「ピカチュウ」を選ぶ",
          ],
          Then: "設定画面の除外ポケモンの一覧に「ピカチュウ」が 1 件表示される",
        },
        {
          When: [
            "クエスト画面を開く",
            "場所選択画面で「廃墟の発電所」を選ぶ",
            "クエスト画面の翻訳の入力欄に「テスト翻訳」と入力する",
            "クエスト画面の翻訳の入力欄で、「この翻訳に決めた！」ボタンを押す",
            "クエスト画面の名前当てで、「わからないのでスキップ →」ボタンを押す",
            "捕獲待機画面で、「モンスターボールを　使う」ボタンを押す",
          ],
          Then: "「捕まえたぞ」と、捕まえたポケモンの日本語名「フシギダネ」が表示される",
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
