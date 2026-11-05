import { test, expect, type Page } from "@playwright/test";
import {
  completeTutorialViaApi,
  MOCK_DAMAGE_PERCENT_MAX,
  MOCK_DAMAGE_PERCENT_MIN,
  readDamagePercent,
  resetExcludedPokemon,
} from "./helpers";
import { BUTTON, PLACEHOLDER, TEXT } from "./labels";

test.skip(() => process.env.E2E_MODE === "dev", "mock-only spec");

async function showScoreAfterSubmittingTranslation(page: Page) {
  await page.goto("/quest");
  await page.getByRole("button", { name: BUTTON.selectPowerPlant }).click();
  await page.getByTestId("quest-description").waitFor();

  await page.getByPlaceholder(PLACEHOLDER.translation).fill("テスト翻訳です");
  await page.getByRole("button", { name: BUTTON.submitTranslation }).click();
  await expect(page.getByText(TEXT.damage)).toBeVisible();
}

test.describe("[本体:ホーム画面から捕獲結果画面]通常の動線", () => {
  test.describe("外部サービスをモックにした環境で、チュートリアルが完了済みで、除外ポケモンが未設定のとき", () => {
    test.beforeEach(async ({ page }) => {
      await completeTutorialViaApi(page);
      await resetExcludedPokemon(page);
    });

    test.describe("シナリオテスト", () => {
      test.describe("正常系", () => {
        test("ホーム画面で「ポケモンを探しに行く」を押してクエスト画面に遷移し、「廃墟の発電所」を選ぶと英文「It raises its tail to check its surroundings. The tail is sometimes struck by lightning in this pose.」が表示され、翻訳「テスト翻訳です」を送信するとダメージがモックの採点が取りうる範囲内で表示され、博士からのコメントに「モック講評だぞ」が表示され、英語名「pikachu」を入力して「君に決めた」を押すと「正解！」と表示され、「次へ進む」を押すと「ハイパーボール」が表示され、ボールを使うと、「捕まえたぞ」と、捕まえたポケモンの英語名「Pikachu」、日本語名「ピカチュウ」と「次のポケモンを探す」が表示される", async ({
          page,
        }) => {
          await page.goto("/");
          await page.getByRole("button", { name: BUTTON.startQuest }).click();
          await expect(page).toHaveURL("/quest");

          await page
            .getByRole("button", { name: BUTTON.selectPowerPlant })
            .click();

          await expect(page.getByTestId("quest-description")).toContainText(
            "It raises its tail to check its surroundings. The tail is sometimes struck by lightning in this pose.",
          );

          await page
            .getByPlaceholder(PLACEHOLDER.translation)
            .fill("テスト翻訳です");
          await page
            .getByRole("button", { name: BUTTON.submitTranslation })
            .click();

          const damagePercent = await readDamagePercent(page);
          expect(damagePercent).toBeGreaterThanOrEqual(MOCK_DAMAGE_PERCENT_MIN);
          expect(damagePercent).toBeLessThanOrEqual(MOCK_DAMAGE_PERCENT_MAX);
          await expect(page.getByText(TEXT.professorComment)).toBeVisible();
          await expect(page.getByText(/モック講評だぞ/)).toBeVisible();

          await page.getByPlaceholder(PLACEHOLDER.nameGuess).fill("pikachu");
          await page.getByRole("button", { name: BUTTON.decideName }).click();
          await expect(page.getByText(TEXT.correct).first()).toBeVisible();

          await page.getByRole("button", { name: BUTTON.proceed }).click();
          await expect(page.getByText(TEXT.ultraBall).first()).toBeVisible();
          await page.getByRole("button", { name: BUTTON.useBall }).click();

          await expect(page.getByText(TEXT.captured)).toBeVisible();
          await expect(page.getByTestId("captured-name-en")).toHaveText(
            "Pikachu",
          );
          await expect(page.getByTestId("captured-name-ja")).toHaveText(
            "ピカチュウ",
          );
          await expect(
            page.getByRole("button", { name: BUTTON.nextQuest }),
          ).toBeVisible();
        });
      });
    });
  });
});

test.describe("[本体:クエスト画面から捕獲結果画面]通常の動線", () => {
  test.describe("外部サービスをモックにした環境で、チュートリアルが完了済みのとき", () => {
    test.beforeEach(async ({ page }) => {
      await completeTutorialViaApi(page);
    });

    test.describe("「廃墟の発電所」を選んで翻訳「テスト翻訳です」を送信し、採点結果が表示されているとき", () => {
      test.beforeEach(async ({ page }) => {
        await showScoreAfterSubmittingTranslation(page);
      });

      test.describe("シナリオテスト", () => {
        test.describe("正常系", () => {
          test("名前当てに、出題されたポケモンの英語名ではない名前を3回続けて入力すると、1回目は「もう一度やってみよう」、2回目は「ラストチャンス」、3回目は「残念」と表示され、「次へ進む」を押すと「モンスターボール」が表示され、ボールを使うと「捕まえたぞ」と表示される", async ({
            page,
          }) => {
            const nameInput = page.getByPlaceholder(PLACEHOLDER.nameGuess);

            await nameInput.fill("wrongone");
            await page.getByRole("button", { name: BUTTON.decideName }).click();
            await expect(page.getByText(/もう一度やってみよう/)).toBeVisible();

            await nameInput.fill("wrongtwo");
            await page.getByRole("button", { name: BUTTON.decideName }).click();
            await expect(page.getByText(/ラストチャンス/)).toBeVisible();

            await nameInput.fill("wrongthree");
            await page.getByRole("button", { name: BUTTON.decideName }).click();
            await expect(page.getByText(TEXT.wrongFinal)).toBeVisible();

            await page.getByRole("button", { name: BUTTON.proceed }).click();
            await expect(page.getByText(TEXT.pokeBall).first()).toBeVisible();
            await page.getByRole("button", { name: BUTTON.useBall }).click();
            await expect(page.getByText(TEXT.captured)).toBeVisible();
          });

          test("名前当てをスキップすると、「モンスターボール」が表示され、ボールを使うと「捕まえたぞ」と表示される", async ({
            page,
          }) => {
            await page.getByRole("button", { name: BUTTON.skip }).click();
            await expect(page.getByText(TEXT.pokeBall).first()).toBeVisible();

            await page.getByRole("button", { name: BUTTON.useBall }).click();
            await expect(page.getByText(TEXT.captured)).toBeVisible();
          });
        });
      });
    });
  });
});

test.describe("[本体:クエスト画面から捕獲結果画面]異常から回復して目的を達成する動線", () => {
  test.describe("外部サービスをモックにした環境で、チュートリアルが完了済みで、除外ポケモンが未設定のとき", () => {
    test.beforeEach(async ({ page }) => {
      await completeTutorialViaApi(page);
      await resetExcludedPokemon(page);
    });

    test.describe("「廃墟の発電所」を選んで翻訳「テスト翻訳です」を送信し、採点結果が表示されているとき", () => {
      test.beforeEach(async ({ page }) => {
        await showScoreAfterSubmittingTranslation(page);
      });

      test.describe("シナリオテスト", () => {
        test.describe("異常系", () => {
          test("ページをリロードすると、場所選択画面に戻らず、リロード前と同じダメージの採点結果が表示され、出題されていたポケモンの英語名「pikachu」を入力して「君に決めた」を押すと「正解！」と表示され、「次へ進む」を押すと「ハイパーボール」が表示され、ボールを使うと「捕まえたぞ」と表示される", async ({
            page,
          }) => {
            const damagePercentBeforeReload = await readDamagePercent(page);

            await page.reload();

            expect(await readDamagePercent(page)).toBe(
              damagePercentBeforeReload,
            );

            await page.getByPlaceholder(PLACEHOLDER.nameGuess).fill("pikachu");
            await page.getByRole("button", { name: BUTTON.decideName }).click();
            await expect(page.getByText(TEXT.correct).first()).toBeVisible();

            await page.getByRole("button", { name: BUTTON.proceed }).click();
            await expect(page.getByText(TEXT.ultraBall).first()).toBeVisible();
            await page.getByRole("button", { name: BUTTON.useBall }).click();
            await expect(page.getByText(TEXT.captured)).toBeVisible();
          });
        });
      });
    });
  });
});
