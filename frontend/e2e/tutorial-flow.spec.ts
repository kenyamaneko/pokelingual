import { test, expect } from "@playwright/test";
import { BUTTON, LINK, PLACEHOLDER, TEXT } from "./labels";

test.skip(() => process.env.E2E_MODE === "dev", "mock-only spec");

test("チュートリアル全フロー（訳文入力 → 名前当て → 捕獲 → 本番クエストへの導線切り替え）", async ({ page }) => {
  await page.goto("/tutorial");

  const translationInput = page.getByPlaceholder(PLACEHOLDER.translation);
  await page.getByText(TEXT.tutorialTranslationInstruction).waitFor();
  // click は要素が他の要素に覆われていないかを検査するため、fill だけでは検出できない
  // 「吹き出しが入力欄を覆っている」という回帰をここで検出できる
  await translationInput.click();
  await translationInput.fill("電気タイプのねずみポケモン");
  await expect(translationInput).toHaveValue("電気タイプのねずみポケモン");
  await page.getByRole("button", { name: BUTTON.submitTranslation }).click();
  await expect(page.getByText("100", { exact: true })).toBeVisible();

  const nameInput = page.getByPlaceholder(PLACEHOLDER.nameGuess);
  await page.getByText(TEXT.tutorialNameInstruction).waitFor();
  await nameInput.click();
  await nameInput.fill("pikachu");
  await expect(nameInput).toHaveValue("pikachu");
  await page.getByRole("button", { name: BUTTON.decideName }).click();

  await page.getByRole("button", { name: BUTTON.useBall }).click();
  await expect(page.getByText(TEXT.captured)).toBeVisible();
  await expect(page.getByTestId("captured-name-en")).toHaveText("Pikachu");

  await page.getByRole("button", { name: BUTTON.backToMenu }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("link", { name: LINK.startQuest })).toHaveAttribute("href", "/quest");
});
