import { test, expect } from "@playwright/test";
import { BUTTON, PLACEHOLDER, TEXT } from "./labels";

test.skip(() => process.env.E2E_MODE === "dev", "mock-only spec");

test.describe("[本体:チュートリアル画面からクエスト画面]通常の動線", () => {
  test.describe("シナリオテスト", () => {
    test.describe("正常系", () => {
      test("チュートリアル画面を開くと「遊び方の説明をします」が表示され、「はじめる」を押し、吹き出しの「この英文を訳してみよう」の案内が出たあと、翻訳「電気タイプのねずみポケモン」を入力すると入力欄にその文字列が表示され、送信するとダメージが「99%」と表示され、吹き出しの「このポケモンの名前を当てよう」の案内が出たあと、名前「pikachu」を入力すると入力欄にその文字列が表示され、「君に決めた」を押し、「次へ進む」を押すと「ハイパーボール」が表示され、ボールを使うと、「捕まえたぞ」と、捕まえたポケモンの英語名「Pikachu」と、「これでチュートリアルは完了だよ」の案内が表示され、「メニューに戻る」を押すとホーム画面に遷移し、「ポケモンを探しに行く」を押すと、クエスト画面に遷移する", async ({
        page,
      }) => {
        await page.goto("/tutorial");

        await expect(page.getByText(TEXT.tutorialHowToPlay)).toBeVisible();
        await page.getByRole("button", { name: BUTTON.startTutorial }).click();

        const translationInput = page.getByPlaceholder(PLACEHOLDER.translation);
        await page.getByText(TEXT.tutorialTranslationInstruction).waitFor();
        await translationInput.click();
        await translationInput.fill("電気タイプのねずみポケモン");
        await expect(translationInput).toHaveValue(
          "電気タイプのねずみポケモン",
        );
        await page
          .getByRole("button", { name: BUTTON.submitTranslation })
          .click();
        await expect(page.getByTestId("damage-value")).toHaveText("99%");

        const nameInput = page.getByPlaceholder(PLACEHOLDER.nameGuess);
        await page.getByText(TEXT.tutorialNameInstruction).waitFor();
        await nameInput.click();
        await nameInput.fill("pikachu");
        await expect(nameInput).toHaveValue("pikachu");
        await page.getByRole("button", { name: BUTTON.decideName }).click();

        await page.getByRole("button", { name: BUTTON.proceed }).click();
        await expect(
          page.getByRole("button", { name: TEXT.ultraBall }),
        ).toBeVisible();

        await page.getByRole("button", { name: BUTTON.useBall }).click();
        await expect(page.getByText(TEXT.captured)).toBeVisible();
        await expect(page.getByTestId("captured-name-en")).toHaveText(
          "Pikachu",
        );
        await expect(page.getByText(TEXT.tutorialComplete)).toBeVisible();

        await page.getByRole("button", { name: BUTTON.backToMenu }).click();
        await expect(page).toHaveURL("/");
        await page.getByRole("button", { name: BUTTON.startQuest }).click();
        await expect(page).toHaveURL("/quest");
      });
    });
  });
});
