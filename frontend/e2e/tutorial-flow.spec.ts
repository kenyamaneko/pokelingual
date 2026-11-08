import { test, expect } from "@playwright/test";
import { BUTTON, PLACEHOLDER, TEXT } from "./labels";
import { defineCase } from "./defineCase";
import { prepareLoggedInUserWithIncompleteTutorial } from "./helpers";

test.describe("[シナリオ:チュートリアルを終えてクエストを始める:通常の動線]ホーム画面からクエスト画面", () => {
  defineCase(
    {
      種別: "シナリオテスト",
      正常異常: "正常系",
      環境: ["ローカル", "dev環境"],
      steps: [
        {
          Given: "ログインしていて、チュートリアルが未完了であるとき",
          When: ["ホーム画面で、「ポケモンを探しに行く」ボタンを押す"],
          Then: "チュートリアル画面に遷移し、「遊び方の説明をします」と表示される",
        },
        {
          When: ["チュートリアル画面の遊び方の説明モーダルで、「はじめる」ボタンを押す"],
          Then: "吹き出しに「この英文を訳してみよう」と表示される",
        },
        {
          When: ["チュートリアル画面の翻訳の入力欄に「電気タイプのねずみポケモン」と入力する"],
          Then: "翻訳の入力欄に「電気タイプのねずみポケモン」と表示される",
        },
        {
          When: ["チュートリアル画面の翻訳の段階で、「この翻訳に決めた！」ボタンを押す"],
          Then: "ダメージが「99%」と表示され、吹き出しに「このポケモンの名前を当てよう」と表示される",
        },
        {
          When: ["チュートリアル画面の名前当ての入力欄に「pikachu」と入力する"],
          Then: "名前当ての入力欄に「pikachu」と表示される",
        },
        {
          When: [
            "チュートリアル画面の名前当ての段階で、「君に　決めた！」ボタンを押す",
            "チュートリアル画面の名前当ての段階で、「次へ進む」ボタンを押す",
          ],
          Then: "捕獲待機画面に「ハイパーボールを　使う」ボタンが表示される",
        },
        {
          When: ["チュートリアル画面の捕獲待機で、「ハイパーボールを　使う」ボタンを押す"],
          Then: "「捕まえたぞ」と、捕まえたポケモンの英語名「Pikachu」と、「これでチュートリアルは完了だよ」と表示される",
        },
        { When: ["チュートリアル画面の結果画面で、「メニューに戻る」ボタンを押す"], Then: "ホーム画面に遷移する" },
        { When: ["ホーム画面で、「ポケモンを探しに行く」ボタンを押す"], Then: "クエスト画面に遷移する" },
      ],
    },
    async ({ page }) => {
      await prepareLoggedInUserWithIncompleteTutorial(page);

      await page.getByRole("button", { name: BUTTON.startQuest }).click();
      await expect(page).toHaveURL("/tutorial");
      await expect(page.getByText(TEXT.tutorialHowToPlay)).toBeVisible();

      await page.getByRole("button", { name: BUTTON.startTutorial }).click();
      await expect(page.getByText(TEXT.tutorialTranslationInstruction)).toBeVisible();

      const translationInput = page.getByPlaceholder(PLACEHOLDER.translation);
      await translationInput.click();
      await translationInput.fill("電気タイプのねずみポケモン");
      await expect(translationInput).toHaveValue("電気タイプのねずみポケモン");

      await page.getByRole("button", { name: BUTTON.submitTranslation }).click();
      await expect(page.getByTestId("damage-value")).toHaveText("99%");
      await expect(page.getByText(TEXT.tutorialNameInstruction)).toBeVisible();

      const nameInput = page.getByPlaceholder(PLACEHOLDER.nameGuess);
      await nameInput.click();
      await nameInput.fill("pikachu");
      await expect(nameInput).toHaveValue("pikachu");

      await page.getByRole("button", { name: BUTTON.decideName }).click();
      await page.getByRole("button", { name: BUTTON.proceed }).click();
      await expect(page.getByRole("button", { name: TEXT.ultraBall })).toBeVisible();

      await page.getByRole("button", { name: BUTTON.useBall }).click();
      await expect(page.getByText(TEXT.captured)).toBeVisible();
      await expect(page.getByTestId("captured-name-en")).toHaveText("Pikachu");
      await expect(page.getByText(TEXT.tutorialComplete)).toBeVisible();

      await page.getByRole("button", { name: BUTTON.backToMenu }).click();
      await expect(page).toHaveURL("/");

      await page.getByRole("button", { name: BUTTON.startQuest }).click();
      await expect(page).toHaveURL("/quest");
    },
  );
});
