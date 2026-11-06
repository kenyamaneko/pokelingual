import { test, expect, type Page } from "@playwright/test";
import {
  completeTutorialViaApi,
  MOCK_DAMAGE_PERCENT_MAX,
  MOCK_DAMAGE_PERCENT_MIN,
  readDamagePercent,
  resetExcludedPokemon,
} from "./helpers";
import { BUTTON, PLACEHOLDER, TEXT } from "./labels";
import { defineCase } from "./defineCase";

test.skip(() => process.env.E2E_MODE === "dev", "mock-only spec");

async function showScoreAfterSubmittingTranslation(page: Page) {
  await page.goto("/quest");
  await page.getByRole("button", { name: BUTTON.selectPowerPlant }).click();
  await page.getByTestId("quest-description").waitFor();

  await page.getByPlaceholder(PLACEHOLDER.translation).fill("テスト翻訳です");
  await page.getByRole("button", { name: BUTTON.submitTranslation }).click();
  await expect(page.getByText(TEXT.damage)).toBeVisible();
}

const PRESS_DECIDE_NAME = "クエスト画面の名前当てで「君に決めた」を押す";
const PRESS_PROCEED = "クエスト画面で「次へ進む」を押す";
const USE_BALL = "クエスト画面でボールを使う";
const CAPTURED_SHOWN = "「捕まえたぞ」と表示される";
const SCORE_SHOWN_ENVIRONMENT =
  "外部サービスをモックにした環境で、チュートリアルが完了済みで、「廃墟の発電所」を選んであり、翻訳「テスト翻訳です」を送信済みで、採点結果が表示されているとき";
const SCORE_SHOWN_ENVIRONMENT_WITHOUT_EXCLUSIONS =
  "外部サービスをモックにした環境で、チュートリアルが完了済みで、除外ポケモンが未設定で、「廃墟の発電所」を選んであり、翻訳「テスト翻訳です」を送信済みで、採点結果が表示されているとき";

test.describe("[シナリオ:ポケモンを捕まえる:通常の動線]ホーム画面から捕獲結果画面", () => {
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
          When: ["ホーム画面で「ポケモンを探しに行く」を押す"],
          Then: "クエスト画面に遷移する",
        },
        {
          When: ["クエスト画面で「廃墟の発電所」を選ぶ"],
          Then: "英文「It raises its tail to check its surroundings. The tail is sometimes struck by lightning in this pose.」が表示される",
        },
        {
          When: ["クエスト画面で、翻訳「テスト翻訳です」を送信する"],
          Then: "ダメージがモックの採点が取りうる範囲内で表示され、博士からのコメントに「モック講評だぞ」が表示される",
        },
        {
          When: ["クエスト画面の名前当てに、英語名「pikachu」を入力する", PRESS_DECIDE_NAME],
          Then: "「正解！」と表示される",
        },
        { When: [PRESS_PROCEED], Then: "「ハイパーボール」が表示される" },
        {
          When: [USE_BALL],
          Then: "「捕まえたぞ」と、捕まえたポケモンの英語名「Pikachu」、日本語名「ピカチュウ」と「次のポケモンを探す」が表示される",
        },
      ],
    },
    async ({ page }) => {
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
    },
  );
});

test.describe("[シナリオ:ポケモンを捕まえる:通常の動線]クエスト画面から捕獲結果画面", () => {
  test.beforeEach(async ({ page }) => {
    await completeTutorialViaApi(page);
    await showScoreAfterSubmittingTranslation(page);
  });

  defineCase(
    {
      種別: "シナリオテスト",
      正常異常: "正常系",
      観点: ["境界値"],
      環境: ["ローカル"],
      steps: [
        {
          Given: SCORE_SHOWN_ENVIRONMENT,
          When: [
            "クエスト画面の名前当てに、出題されたポケモンの英語名ではない名前を 1 回目として入力する",
            PRESS_DECIDE_NAME,
          ],
          Then: "「もう一度やってみよう」と表示される",
        },
        {
          When: [
            "クエスト画面の名前当てに、出題されたポケモンの英語名ではない名前を 2 回目として入力する",
            PRESS_DECIDE_NAME,
          ],
          Then: "「ラストチャンス」と表示される",
        },
        {
          When: [
            "クエスト画面の名前当てに、出題されたポケモンの英語名ではない名前を 3 回目として入力する",
            PRESS_DECIDE_NAME,
          ],
          Then: "「残念」と表示される",
        },
        { When: [PRESS_PROCEED], Then: "「モンスターボール」が表示される" },
        { When: [USE_BALL], Then: CAPTURED_SHOWN },
      ],
    },
    async ({ page }) => {
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
    },
  );

  defineCase(
    {
      種別: "シナリオテスト",
      正常異常: "正常系",
      環境: ["ローカル"],
      steps: [
        {
          Given: SCORE_SHOWN_ENVIRONMENT,
          When: ["クエスト画面の名前当てをスキップする"],
          Then: "「モンスターボール」が表示される",
        },
        { When: [USE_BALL], Then: CAPTURED_SHOWN },
      ],
    },
    async ({ page }) => {
      await page.getByRole("button", { name: BUTTON.skip }).click();
      await expect(page.getByText(TEXT.pokeBall).first()).toBeVisible();

      await page.getByRole("button", { name: BUTTON.useBall }).click();
      await expect(page.getByText(TEXT.captured)).toBeVisible();
    },
  );
});

test.describe("[シナリオ:ポケモンを捕まえる:異常から回復して目的を達成する動線]クエスト画面から捕獲結果画面", () => {
  test.beforeEach(async ({ page }) => {
    await completeTutorialViaApi(page);
    await resetExcludedPokemon(page);
    await showScoreAfterSubmittingTranslation(page);
  });

  defineCase(
    {
      種別: "シナリオテスト",
      正常異常: "異常系",
      環境: ["ローカル"],
      steps: [
        {
          Given: SCORE_SHOWN_ENVIRONMENT_WITHOUT_EXCLUSIONS,
          When: ["クエスト画面のページをリロードする"],
          Then: "リロード前と同じダメージの採点結果が表示される",
        },
        {
          When: ["クエスト画面の名前当てに、出題されていたポケモンの英語名「pikachu」を入力する", PRESS_DECIDE_NAME],
          Then: "「正解！」と表示される",
        },
        { When: [PRESS_PROCEED], Then: "「ハイパーボール」が表示される" },
        { When: [USE_BALL], Then: CAPTURED_SHOWN },
      ],
    },
    async ({ page }) => {
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
    },
  );
});
