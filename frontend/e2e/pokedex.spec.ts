import { test, expect } from "@playwright/test";
import {
  completeQuest,
  completeTutorialViaApi,
  countCapturesViaApi,
  MOCK_DAMAGE_PERCENT_MAX,
  resetExcludedPokemon,
} from "./helpers";
import { BUTTON, HEADING, LINK, TEXT } from "./labels";

const PIKACHU_POKEDEX_ID = 25;

test.skip(() => process.env.E2E_MODE === "dev", "mock-only spec");

test.describe("[本体:図鑑]図鑑画面の表示", () => {
  test.describe("チュートリアルが完了済みのとき", () => {
    test.beforeEach(async ({ page }) => {
      await completeTutorialViaApi(page);
    });

    test.describe("ホーム画面の「図鑑を見る」を押すと", () => {
      test.beforeEach(async ({ page }) => {
        await page.goto("/");
        await page.getByRole("link", { name: LINK.viewPokedex }).click();
      });

      test.describe("E2Eテスト", () => {
        test.describe("正常系", () => {
          test("図鑑画面に遷移する", async ({ page }) => {
            await expect(page).toHaveURL("/pokedex");
          });

          test("見出し「図鑑」が表示される", async ({ page }) => {
            await expect(
              page.getByRole("heading", { name: HEADING.pokedex }),
            ).toBeVisible();
          });
        });
      });
    });
  });
});

test.describe("[本体:クエスト画面から図鑑画面]通常の動線", () => {
  test.describe("外部サービスをモックにした環境で、チュートリアルが完了済みで、除外ポケモンが未設定のとき", () => {
    test.beforeEach(async ({ page }) => {
      await completeTutorialViaApi(page);
      await resetExcludedPokemon(page);
    });

    test.describe("シナリオテスト", () => {
      test.describe("正常系", () => {
        test("クエスト画面で「廃墟の発電所」を選び、翻訳「テスト翻訳」を送信し、名前当てをスキップしてボールを使い、ポケモンを捕まえたあとに図鑑画面を開くと、捕まえたポケモンの日本語名「ピカチュウ」のカードが表示され、カードを押すと詳細モーダルに、「捕獲回数」が捕まえる前より1多い値で表示され、「最高スコア」が今回のダメージ以上で、モックの採点が取りうる範囲内の値で表示され、「閉じる」を押すと「最高スコア」の表示が消える", async ({
          page,
        }) => {
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
        });
      });
    });
  });
});
