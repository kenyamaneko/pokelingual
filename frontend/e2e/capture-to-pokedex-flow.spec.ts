import { test, expect, type Page, type Response } from "@playwright/test";
import { byEnvironment, defineCase } from "./defineCase";
import {
  MOCK_DAMAGE_PERCENT_MAX,
  MOCK_DAMAGE_PERCENT_MIN,
  prepareLoggedInUserWithCompletedTutorialAndNoExcludedPokemon,
  readDamagePercent,
  SCORE_REVEAL_TIMEOUT_MS,
} from "./helpers";
import { BUTTON, HEADING, LINK, PLACEHOLDER, TEXT } from "./labels";
import type { QuestLocationsResponse } from "../../shared/api-types/quest";

const DAMAGE_PERCENT_LOWER_LIMIT = 0;
const DAMAGE_PERCENT_UPPER_LIMIT = 100;

const DAMAGE_PERCENT_RANGE = byEnvironment({
  ローカル: { min: MOCK_DAMAGE_PERCENT_MIN, max: MOCK_DAMAGE_PERCENT_MAX },
  dev環境: { min: DAMAGE_PERCENT_LOWER_LIMIT, max: DAMAGE_PERCENT_UPPER_LIMIT },
});

const QUEST_DESCRIPTION = byEnvironment<string | RegExp>({
  ローカル: "It raises its tail to check its surroundings. The tail is sometimes struck by lightning in this pose.",
  dev環境: /[A-Za-z]+ [A-Za-z]+/,
});

const CAPTURE_RESULT = byEnvironment<string | RegExp>({
  ローカル: TEXT.captured,
  dev環境: /捕まえたぞ|逃げ出した/,
});

const CAPTURED_NAME_EN = byEnvironment<string | RegExp>({
  ローカル: "Pikachu",
  dev環境: /[A-Za-z]/,
});

const CAPTURED_NAME_JA = byEnvironment<string | RegExp>({
  ローカル: "ピカチュウ",
  dev環境: /[ぁ-んァ-ヶ一-龠]/,
});

const selectLocation = byEnvironment<(page: Page, locationsLoaded: Promise<Response>) => Promise<void>>({
  ローカル: async (page) => {
    await page.getByRole("button", { name: BUTTON.selectPowerPlant }).click();
  },
  dev環境: async (page, locationsLoaded) => {
    const { locations } = (await (await locationsLoaded).json()) as QuestLocationsResponse;
    await page.getByRole("button", { name: locations[0].name }).click();
  },
});

const expectProfessorComment = byEnvironment<(page: Page) => Promise<void>>({
  ローカル: async (page) => {
    await expect(page.getByText(TEXT.professorComment)).toBeVisible();
    await expect(page.getByText(/モック講評だぞ/)).toBeVisible();
  },
  dev環境: async () => {},
});

test.describe("[シナリオ:ポケモンを捕まえる:通常の動線]ホーム画面から図鑑画面", () => {
  defineCase(
    {
      種別: "シナリオテスト",
      正常異常: "正常系",
      環境: ["ローカル", "dev環境"],
      steps: [
        {
          Given: "ログインしていて、チュートリアルが完了済みで、除外ポケモンが未設定であるとき",
          When: ["ホーム画面で、「ポケモンを探しに行く」ボタンを押す"],
          Then: "クエスト画面に遷移する",
        },
        {
          When: ["場所選択画面で、表示された場所を 1 つ選ぶ"],
          Then: {
            ローカル: "英文「It raises its tail to check its surroundings. The tail is sometimes struck by lightning in this pose.」が表示される",
            dev環境: "英単語を含む英文が表示される",
          },
        },
        {
          When: [
            "クエスト画面の翻訳の入力欄に「このポケモンが何匹か集まると、強い電気がたまって雷が落ちることがある」と入力する",
            "クエスト画面の翻訳の入力欄で、「この翻訳に決めた！」ボタンを押す",
          ],
          Then: {
            ローカル: "ダメージが、モックの採点が取りうる範囲内の値で表示され、博士からのコメントに「モック講評だぞ」が表示される",
            dev環境: "ダメージが 0% 以上 100% 以下で表示される",
          },
        },
        { When: ["クエスト画面の名前当てで、「わからないのでスキップ →」ボタンを押す"], Then: "「モンスターボール」と表示される" },
        {
          When: ["捕獲待機画面で、「モンスターボールを　使う」ボタンを押す"],
          Then: {
            ローカル: "「捕まえたぞ」と、捕まえたポケモンの英語名「Pikachu」と日本語名「ピカチュウ」と、「次のポケモンを探す」ボタンが表示される",
            dev環境: "「捕まえたぞ」か「逃げ出した」のどちらかと、英字を含む英語名と、仮名か漢字を含む日本語名と、「次のポケモンを探す」ボタンが表示される",
          },
        },
        {
          When: ["クエスト画面のヘッダーで、「ずかん」リンクを押す"],
          Then: "図鑑画面に遷移し、見出し「図鑑」が表示される",
        },
      ],
    },
    async ({ page }) => {
      await prepareLoggedInUserWithCompletedTutorialAndNoExcludedPokemon(page);

      const locationsLoaded = page.waitForResponse(
        (res) =>
          res.url().endsWith("/api/quest/locations") &&
          res.request().method() === "GET",
      );
      await page.getByRole("button", { name: BUTTON.startQuest }).click();
      await expect(page).toHaveURL("/quest");

      await selectLocation(page, locationsLoaded);
      await expect(page.getByTestId("quest-description")).toContainText(QUEST_DESCRIPTION);

      await page.getByPlaceholder(PLACEHOLDER.translation).fill("このポケモンが何匹か集まると、強い電気がたまって雷が落ちることがある");
      await page.getByRole("button", { name: BUTTON.submitTranslation }).click();
      await expect(page.getByTestId("damage-value")).toHaveText(/^\d+%$/, {
        timeout: SCORE_REVEAL_TIMEOUT_MS,
      });
      const damagePercent = await readDamagePercent(page);
      expect(damagePercent).toBeGreaterThanOrEqual(DAMAGE_PERCENT_RANGE.min);
      expect(damagePercent).toBeLessThanOrEqual(DAMAGE_PERCENT_RANGE.max);
      await expectProfessorComment(page);

      await page.getByRole("button", { name: BUTTON.skip }).click();
      await expect(page.getByText(TEXT.pokeBall).first()).toBeVisible();

      await page.getByRole("button", { name: BUTTON.useBall }).click();
      await expect(page.getByText(CAPTURE_RESULT)).toBeVisible();
      await expect(page.getByTestId("captured-name-en")).toHaveText(CAPTURED_NAME_EN);
      await expect(page.getByTestId("captured-name-ja")).toHaveText(CAPTURED_NAME_JA);
      await expect(page.getByRole("button", { name: BUTTON.nextQuest })).toBeVisible();

      await page.getByRole("link", { name: LINK.navPokedex, exact: true }).click();
      await expect(page).toHaveURL("/pokedex");
      await expect(page.getByRole("heading", { name: HEADING.pokedex })).toBeVisible();
    },
  );
});
