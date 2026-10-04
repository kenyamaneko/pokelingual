import { test, expect } from "@playwright/test";
import { completeTutorialViaApi } from "./helpers";
import { BUTTON, PLACEHOLDER, TEXT } from "./labels";

// dev は出題と捕獲が非決定的で正誤・捕獲を確定的に検証できないため、乱数源を差し替えて決定化した mock モード専用にする。
test.skip(() => process.env.E2E_MODE === "dev", "mock-only spec");

test.beforeEach(async ({ page }) => {
  await completeTutorialViaApi(page);
});

test.describe("クエストの進行", () => {
  test.describe("正常系", () => {
    test.describe("mock モードのとき", () => {
      test("チュートリアルが完了済みのとき、「ポケモンを探しに行く」を押して「廃墟の発電所」を選ぶと英文が表示され、翻訳を送信するとダメージと博士からのコメントが表示され、出題されたポケモンの英語名を入力して「君に決めた」を押すと「正解！」と表示され、「次へ進む」を押すと「ハイパーボール」が表示され、ボールを使うと、捕まえたポケモンの英語名と日本語名と「次のポケモンを探す」が表示される", async ({
        page,
      }) => {
        await page.goto("/");
        await page.getByRole("button", { name: BUTTON.startQuest }).click();
        await expect(page).toHaveURL("/quest");

        await page.getByRole("button", { name: BUTTON.selectPowerPlant }).click();

        await page.getByTestId("quest-description").waitFor();
        await expect(page.getByTestId("quest-description")).not.toBeEmpty();

        await page.getByPlaceholder(PLACEHOLDER.translation).fill("テスト翻訳です");
        await page.getByRole("button", { name: BUTTON.submitTranslation }).click();

        await expect(page.getByText(TEXT.damage)).toBeVisible();
        await expect(page.getByText(TEXT.professorComment)).toBeVisible();

        await page.getByPlaceholder(PLACEHOLDER.nameGuess).fill("pikachu");
        await page.getByRole("button", { name: BUTTON.decideName }).click();
        // 「正解！」はタイトルと詳細文の 2 箇所に現れるため first で特定する。
        await expect(page.getByText(TEXT.correct).first()).toBeVisible();

        await page.getByRole("button", { name: BUTTON.proceed }).click();
        await expect(page.getByText(TEXT.ultraBall).first()).toBeVisible();
        await page.getByRole("button", { name: BUTTON.useBall }).click();

        await expect(page.getByText(TEXT.captured)).toBeVisible();
        await expect(page.getByTestId("captured-name-en")).toHaveText("Pikachu");
        await expect(page.getByTestId("captured-name-ja")).toHaveText("ピカチュウ");
        await expect(page.getByRole("button", { name: BUTTON.nextQuest })).toBeVisible();
      });

      test.describe("「廃墟の発電所」を選んで翻訳を送信し、採点結果が表示されているとき", () => {
        test.beforeEach(async ({ page }) => {
          await page.goto("/quest");
          await page.getByRole("button", { name: BUTTON.selectPowerPlant }).click();
          await page.getByTestId("quest-description").waitFor();

          await page.getByPlaceholder(PLACEHOLDER.translation).fill("テスト翻訳です");
          await page.getByRole("button", { name: BUTTON.submitTranslation }).click();
          await expect(page.getByText(TEXT.damage)).toBeVisible();
        });

        test("名前当てに3回続けて誤った名前を入力すると、1回目と2回目は「はずれ」、3回目は「残念」と表示され、「次へ進む」を押すと「モンスターボール」が表示され、ボールを使うと「捕まえたぞ」と表示される", async ({
          page,
        }) => {
          const nameInput = page.getByPlaceholder(PLACEHOLDER.nameGuess);

          await nameInput.fill("wrongone");
          await page.getByRole("button", { name: BUTTON.decideName }).click();
          await expect(page.getByText(TEXT.wrong).first()).toBeVisible();

          await nameInput.fill("wrongtwo");
          await page.getByRole("button", { name: BUTTON.decideName }).click();
          await expect(page.getByText(TEXT.wrong).first()).toBeVisible();

          await nameInput.fill("wrongthree");
          await page.getByRole("button", { name: BUTTON.decideName }).click();
          await expect(page.getByText(TEXT.wrongFinal)).toBeVisible();

          await page.getByRole("button", { name: BUTTON.proceed }).click();
          await expect(page.getByText(TEXT.pokeBall).first()).toBeVisible();
          await page.getByRole("button", { name: BUTTON.useBall }).click();
          await expect(page.getByText(TEXT.captured)).toBeVisible();
        });

        test("ページをリロードすると、場所選択画面に戻らず採点結果が表示され、リロード前に出題されたポケモンの英語名を入力して「君に決めた」を押すと「正解！」と表示され、「次へ進む」を押すと「ハイパーボール」が表示され、ボールを使うと「捕まえたぞ」と表示される", async ({
          page,
        }) => {
          await page.reload();

          await expect(page.getByText(TEXT.damage)).toBeVisible();

          await page.getByPlaceholder(PLACEHOLDER.nameGuess).fill("pikachu");
          await page.getByRole("button", { name: BUTTON.decideName }).click();
          await expect(page.getByText(TEXT.correct).first()).toBeVisible();

          await page.getByRole("button", { name: BUTTON.proceed }).click();
          await expect(page.getByText(TEXT.ultraBall).first()).toBeVisible();
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
