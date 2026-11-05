import { test, expect } from "@playwright/test";
import {
  completeQuest,
  completeTutorialViaApi,
  countCapturesViaApi,
  MOCK_DAMAGE_PERCENT_MAX,
  resetExcludedPokemon,
} from "./helpers";
import { BUTTON, HEADING, LINK, TEXT } from "./labels";
import { defineCase } from "./defineCase";

const PIKACHU_POKEDEX_ID = 25;

test.skip(() => process.env.E2E_MODE === "dev", "mock-only spec");

const PRESS_VIEW_POKEDEX = "ホーム画面の「図鑑を見る」を押す";

test.describe("[本体:図鑑]図鑑画面の表示", () => {
  test.beforeEach(async ({ page }) => {
    await completeTutorialViaApi(page);
    await page.goto("/");
    await page.getByRole("link", { name: LINK.viewPokedex }).click();
  });

  defineCase(
    {
      種別: "E2Eテスト",
      正常異常: "正常系",
      steps: [{ Given: "チュートリアルが完了済みのとき", When: [PRESS_VIEW_POKEDEX], Then: "図鑑画面に遷移する" }],
    },
    async ({ page }) => {
      await expect(page).toHaveURL("/pokedex");
    },
  );

  defineCase(
    {
      種別: "E2Eテスト",
      正常異常: "正常系",
      steps: [
        { Given: "チュートリアルが完了済みのとき", When: [PRESS_VIEW_POKEDEX], Then: "見出し「図鑑」が表示される" },
      ],
    },
    async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: HEADING.pokedex }),
      ).toBeVisible();
    },
  );
});

test.describe("[シナリオ:捕まえたポケモンを図鑑で確かめる:通常の動線]クエスト画面から図鑑画面", () => {
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
          Given: "外部サービスをモックにした環境で、チュートリアルが完了済みで、除外ポケモンが未設定のとき",
          When: [
            "クエスト画面で「廃墟の発電所」を選ぶ",
            "クエスト画面で、翻訳「テスト翻訳」を送信する",
            "クエスト画面の名前当てをスキップする",
            "クエスト画面でボールを使う",
            "ポケモンを捕まえたあとに図鑑画面を開く",
          ],
          Then: "捕まえたポケモンの日本語名「ピカチュウ」のカードが表示される",
        },
        {
          When: ["図鑑画面で、捕まえたポケモンのカードを押す"],
          Then: "詳細モーダルに、「捕獲回数」が捕まえる前より1多い値で表示され、「最高スコア」が今回のダメージ以上で、モックの採点が取りうる範囲内の値で表示される",
        },
        { When: ["図鑑画面のポケモンの詳細モーダルで「閉じる」を押す"], Then: "「最高スコア」の表示が消える" },
      ],
    },
    async ({ page }) => {
      const capturesBeforeQuest = await countCapturesViaApi(
        page,
        PIKACHU_POKEDEX_ID,
      );
      const damagePercent = await completeQuest(page);

      await page.goto("/pokedex");

      const pokemonCard = page
        .getByTestId("pokemon-card")
        .filter({ hasText: "ピカチュウ" });
      await expect(pokemonCard).toBeVisible();

      await pokemonCard.click();

      await expect(
        page.getByText(TEXT.captureCount).locator(".."),
      ).toHaveText(`捕獲回数${capturesBeforeQuest + 1}`);

      const bestScoreCell = page.getByText(TEXT.bestScore).locator("..");
      await expect(bestScoreCell).toHaveText(/^最高スコア\d+$/);
      const bestScore = Number(
        (await bestScoreCell.innerText()).replace(/\D/g, ""),
      );
      expect(bestScore).toBeGreaterThanOrEqual(damagePercent);
      expect(bestScore).toBeLessThanOrEqual(MOCK_DAMAGE_PERCENT_MAX);

      await page.getByRole("button", { name: BUTTON.close }).click();
      await expect(page.getByText(TEXT.bestScore)).not.toBeVisible();
    },
  );
});
