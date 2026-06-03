import { test, expect } from "@playwright/test";
import { BUTTON, LINK, PLACEHOLDER, TEXT } from "./labels";

// 固定ポケモン集合・即時採点を前提とする mock モード専用。dev は dev-signup-flow.spec.ts が担当。
test.skip(() => process.env.E2E_MODE === "dev", "mock-only spec");

test("クエスト全フロー（翻訳 → 採点 → 名前当て → 捕獲 → 結果）", async ({
  page,
}) => {
  // ホームページからクエスト開始
  await page.goto("/");
  await page.getByRole("link", { name: LINK.startQuest }).click();
  await expect(page).toHaveURL("/quest");

  // クエストカードが表示される
  await page.getByText(TEXT.questTitle).waitFor();
  const description = page.getByTestId("quest-description");
  await expect(description).not.toBeEmpty();

  // 翻訳入力 → 送信
  await page.getByPlaceholder(PLACEHOLDER.translation).fill("テスト翻訳です");
  await page.getByRole("button", { name: BUTTON.submitTranslation }).click();

  // スコア表示を確認
  await expect(page.getByText(TEXT.damage)).toBeVisible();

  // 博士からのコメントを確認
  await expect(page.getByText(TEXT.professorComment)).toBeVisible();

  // 名前推測: mock モードでは Pikachu, Bulbasaur, Charmander, Squirtle, Mewtwo のいずれか
  // "pikachu" で試す（当たらなくても3回で終了）
  const nameInput = page.getByPlaceholder(PLACEHOLDER.nameGuess);
  await nameInput.fill("pikachu");
  await page.getByRole("button", { name: BUTTON.decideName }).click();

  // 名前当て結果が表示される（せいかい or はずれ）
  const correct = page.getByText(TEXT.correct);
  const wrong = page.getByText(TEXT.wrong);
  await expect(correct.or(wrong)).toBeVisible();

  // スキップで次へ進む（不正解の場合もあるため）
  await page.getByRole("button", { name: BUTTON.proceedOrSkip }).click();

  // ボール画面
  await page.getByRole("button", { name: BUTTON.useBall }).click();

  // 捕獲結果 → ポケモン名が表示される
  const captured = page.getByText(TEXT.captured);
  const escaped = page.getByText(TEXT.escaped);
  await expect(captured.or(escaped)).toBeVisible();

  // ポケモンの英語名と日本語名が表示される
  await expect(page.getByTestId("captured-name-en")).toBeVisible();
  await expect(page.getByTestId("captured-name-ja")).toBeVisible();

  // 次のクエストへのボタンが表示される
  await expect(
    page.getByRole("button", { name: BUTTON.nextQuest })
  ).toBeVisible();
});

test("翻訳スキップ → 名前スキップの最短フロー", async ({ page }) => {
  await page.goto("/quest");
  await page.getByText(TEXT.questTitle).waitFor();

  // 最低限の翻訳を入力
  await page.getByPlaceholder(PLACEHOLDER.translation).fill("テスト");
  await page.getByRole("button", { name: BUTTON.submitTranslation }).click();

  // スコア表示
  await expect(page.getByText(TEXT.damage)).toBeVisible();

  // 名前スキップ
  await page.getByRole("button", { name: BUTTON.skip }).click();

  // ボール使用
  await page.getByRole("button", { name: BUTTON.useBall }).click();

  // 結果表示
  const captured = page.getByText(TEXT.captured);
  const escaped = page.getByText(TEXT.escaped);
  await expect(captured.or(escaped)).toBeVisible();
});
