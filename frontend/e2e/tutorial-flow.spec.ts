import { test, expect } from "@playwright/test";
import { BUTTON, PLACEHOLDER, TEXT } from "./labels";
import { defineCase } from "./defineCase";

test.skip(() => process.env.E2E_MODE === "dev", "mock-only spec");

test.describe("[シナリオ:チュートリアルを終えてクエストを始める:通常の動線]チュートリアル画面からクエスト画面", () => {
  defineCase(
    {
      種別: "シナリオテスト",
      正常異常: "正常系",
      steps: [
        { When: ["チュートリアル画面を開く"], Then: "「遊び方の説明をします」が表示される" },
        { When: ["「はじめる」を押す"], Then: "吹き出しの「この英文を訳してみよう」の案内が出る" },
        { When: ["翻訳「電気タイプのねずみポケモン」を入力する"], Then: "入力欄にその文字列が表示される" },
        {
          When: ["送信する"],
          Then: "ダメージが「99%」と表示され、吹き出しの「このポケモンの名前を当てよう」の案内が出る",
        },
        { When: ["名前「pikachu」を入力する"], Then: "入力欄にその文字列が表示される" },
        { When: ["「君に決めた」を押す", "「次へ進む」を押す"], Then: "「ハイパーボール」が表示される" },
        {
          When: ["ボールを使う"],
          Then: "「捕まえたぞ」と、捕まえたポケモンの英語名「Pikachu」と、「これでチュートリアルは完了だよ」の案内が表示される",
        },
        { When: ["「メニューに戻る」を押す"], Then: "ホーム画面に遷移する" },
        { When: ["「ポケモンを探しに行く」を押す"], Then: "クエスト画面に遷移する" },
      ],
    },
    async ({ page }) => {
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
    },
  );
});
