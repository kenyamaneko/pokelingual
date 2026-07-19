import { test, expect } from "@playwright/test";
import { completeTutorialViaApi } from "./helpers";
import { BUTTON, PLACEHOLDER, TEXT } from "./labels";

// mock モード専用。dev は dev-quest-flow.spec.ts が担当。
// mock は場所選択・出題・捕獲が MockRandomSource で決定化されている。「廃墟の発電所」(でんき) を
// 選ぶと出題は必ずピカチュウ、捕獲も必ず成功するため、正誤・捕獲を確定的に検証できる。
test.skip(() => process.env.E2E_MODE === "dev", "mock-only spec");

// このファイルは本番クエストを検証する。dev-user のチュートリアル完了状態を先に立てておく
test.beforeEach(async ({ page }) => {
  await completeTutorialViaApi(page);
});

test("クエスト全フロー（翻訳 → 採点 → 名前当て正解 → ハイパーボールで捕獲）", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: BUTTON.startQuest }).click();
  await expect(page).toHaveURL("/quest");

  await page.getByRole("button", { name: BUTTON.selectPowerPlant }).click();

  // クエストカードが表示される
  await page.getByTestId("quest-description").waitFor();
  await expect(page.getByTestId("quest-description")).not.toBeEmpty();

  // 翻訳入力 → 送信
  await page.getByPlaceholder(PLACEHOLDER.translation).fill("テスト翻訳です");
  await page.getByRole("button", { name: BUTTON.submitTranslation }).click();

  // スコアと博士のコメントが表示される
  await expect(page.getByText(TEXT.damage)).toBeVisible();
  await expect(page.getByText(TEXT.professorComment)).toBeVisible();

  // 出題は決定的にピカチュウなので、英語名の正解を確定的に検証できる
  await page.getByPlaceholder(PLACEHOLDER.nameGuess).fill("pikachu");
  await page.getByRole("button", { name: BUTTON.decideName }).click();
  // 「せいかい！」はタイトルと詳細文の 2 箇所に現れるため first で特定する
  await expect(page.getByText(TEXT.correct).first()).toBeVisible();

  // 英語名正解 → ハイパーボール
  await page.getByRole("button", { name: BUTTON.proceed }).click();
  await expect(page.getByText(TEXT.ultraBall).first()).toBeVisible();
  await page.getByRole("button", { name: BUTTON.useBall }).click();

  // 捕獲抽選も決定的 (必ず捕獲)。捕獲したポケモンの名前まで確認する
  await expect(page.getByText(TEXT.captured)).toBeVisible();
  await expect(page.getByTestId("captured-name-en")).toHaveText("Pikachu");
  await expect(page.getByTestId("captured-name-ja")).toHaveText("ピカチュウ");
  await expect(page.getByRole("button", { name: BUTTON.nextQuest })).toBeVisible();
});

test("名前当てに3回失敗すると、モンスターボールで捕獲する", async ({
  page,
}) => {
  await page.goto("/quest");
  await page.getByRole("button", { name: BUTTON.selectPowerPlant }).click();
  await page.getByTestId("quest-description").waitFor();

  await page.getByPlaceholder(PLACEHOLDER.translation).fill("テスト");
  await page.getByRole("button", { name: BUTTON.submitTranslation }).click();
  await expect(page.getByText(TEXT.damage)).toBeVisible();

  const nameInput = page.getByPlaceholder(PLACEHOLDER.nameGuess);

  // 1回目の不正解
  await nameInput.fill("wrongone");
  await page.getByRole("button", { name: BUTTON.decideName }).click();
  await expect(page.getByText(TEXT.wrong).first()).toBeVisible();

  // 2回目の不正解
  await nameInput.fill("wrongtwo");
  await page.getByRole("button", { name: BUTTON.decideName }).click();
  await expect(page.getByText(TEXT.wrong).first()).toBeVisible();

  // 3回目の不正解
  await nameInput.fill("wrongthree");
  await page.getByRole("button", { name: BUTTON.decideName }).click();
  await expect(page.getByText(TEXT.wrongFinal)).toBeVisible();

  // 失敗時はモンスターボール
  await page.getByRole("button", { name: BUTTON.proceed }).click();
  await expect(page.getByText(TEXT.pokeBall).first()).toBeVisible();
  await page.getByRole("button", { name: BUTTON.useBall }).click();
  await expect(page.getByText(TEXT.captured)).toBeVisible();
});

test("翻訳 → 名前スキップ → モンスターボールで捕獲の最短フロー", async ({ page }) => {
  await page.goto("/quest");
  await page.getByRole("button", { name: BUTTON.selectPowerPlant }).click();
  await page.getByTestId("quest-description").waitFor();

  // 最低限の翻訳を入力
  await page.getByPlaceholder(PLACEHOLDER.translation).fill("テスト");
  await page.getByRole("button", { name: BUTTON.submitTranslation }).click();

  // スコア表示
  await expect(page.getByText(TEXT.damage)).toBeVisible();

  // 名前スキップ → モンスターボール
  await page.getByRole("button", { name: BUTTON.skip }).click();
  await expect(page.getByText(TEXT.pokeBall).first()).toBeVisible();

  // ボール使用 → 必ず捕獲
  await page.getByRole("button", { name: BUTTON.useBall }).click();
  await expect(page.getByText(TEXT.captured)).toBeVisible();
});
