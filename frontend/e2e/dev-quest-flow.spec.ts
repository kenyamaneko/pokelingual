import { test, expect, type Page, type Response } from "@playwright/test";
import { loginViaUi } from "./helpers";
import { BUTTON, HEADING, PLACEHOLDER, TEXT } from "./labels";
import { defineCase } from "./defineCase";
import type { QuestLocationsResponse } from "../../shared/api-types/quest";

test.skip(() => process.env.E2E_MODE !== "dev", "cloud-dev only spec");

const SCORE_REVEAL_TIMEOUT_MS = 30_000;

/**
 * 検証済みのテスト用ユーザーでログインする。
 * @returns ログイン後にホーム画面が取得したチュートリアル完了状態の応答。
 */
async function loginAsTestUser(page: Page): Promise<Response> {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  // dev ではメール確認済みのテスト用ユーザーの資格情報が必須のため、未設定なら誤った対象を叩く前に失敗させる。
  if (!email || !password) {
    throw new Error("E2E_EMAIL and E2E_PASSWORD must be set for dev mode");
  }

  const tutorialStatusLoaded = page.waitForResponse(
    (res) =>
      res.url().includes("/api/tutorial-status") &&
      res.request().method() === "GET",
  );
  await loginViaUi(page, email, password);
  await expect(page).toHaveURL("/");
  return tutorialStatusLoaded;
}

/**
 * ログイン済みユーザーのチュートリアル完了状態を、利用者自身の資格で API から指定の状態にし、ホーム画面を読み直す。
 * @param tutorialStatusResponse ログイン後にホーム画面が取得したチュートリアル完了状態の応答。
 * @param state 用意する状態。完了済みにするなら "complete"、未完了に戻すなら "reset"。
 */
async function setTutorialStatusOfLoggedInUser(
  page: Page,
  tutorialStatusResponse: Response,
  state: "complete" | "reset",
) {
  const { authorization } = await tutorialStatusResponse.request().allHeaders();
  const res = await page.request.put(
    `${tutorialStatusResponse.url()}/${state}`,
    {
      headers: { authorization },
    },
  );
  expect(res.ok()).toBe(true);
  await page.reload();
}

/**
 * 検証済みのテスト用ユーザーでログインし、チュートリアルを指定の状態にしてホーム画面を読み直す。
 * @param state 用意する状態。完了済みにするなら "complete"、未完了に戻すなら "reset"。
 */
async function loginAsTestUserWithTutorialStatus(page: Page, state: "complete" | "reset") {
  const tutorialStatusResponse = await loginAsTestUser(page);
  await setTutorialStatusOfLoggedInUser(page, tutorialStatusResponse, state);
}

test.describe("[本体:クエスト]クエストの進行", () => {
  defineCase(
    {
      種別: "スモークテスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "dev 環境で、メール確認済みのテスト用ユーザーとしてログインしていて、チュートリアルが未完了であるとき",
          When: [
            "ホーム画面で「ポケモンを探しに行く」を押して、クエストを始める",
            "チュートリアル画面の「はじめる」を押す",
            "チュートリアル画面の翻訳の入力欄に、「電気タイプのねずみポケモン」と入力する",
            "チュートリアル画面の「この翻訳に決めた」を押して、翻訳を送信する",
            "チュートリアル画面の名前当ての入力欄に、「pikachu」と入力する",
            "チュートリアル画面の「君に決めた」を押す",
            "チュートリアル画面の「次へ進む」を押す",
            "チュートリアル画面でボールを使う",
            "チュートリアル画面の「メニューに戻る」を押す",
            "ホーム画面でもう一度「ポケモンを探しに行く」を押して、クエストを始める",
          ],
          Then: "チュートリアル画面に遷移し、ダメージが「99%」と表示され、「捕まえたぞ」と、捕まえたポケモンの英語名「Pikachu」と、「これでチュートリアルは完了だよ」の案内が表示され、ホーム画面を経てクエスト画面に遷移する",
        },
      ],
    },
    async ({ page }) => {
      await loginAsTestUserWithTutorialStatus(page, "reset");

      await page.getByRole("button", { name: BUTTON.startQuest }).click();
      await expect(page).toHaveURL("/tutorial");
      await page
        .getByRole("button", { name: BUTTON.startTutorial })
        .click();

      await page
        .getByPlaceholder(PLACEHOLDER.translation)
        .fill("電気タイプのねずみポケモン");
      await page
        .getByRole("button", { name: BUTTON.submitTranslation })
        .click();
      await expect(page.getByTestId("damage-value")).toHaveText("99%");

      await page.getByPlaceholder(PLACEHOLDER.nameGuess).fill("pikachu");
      await page.getByRole("button", { name: BUTTON.decideName }).click();
      await page.getByRole("button", { name: BUTTON.proceed }).click();

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

  defineCase(
    {
      種別: "スモークテスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "dev 環境で、メール確認済みのテスト用ユーザーとしてログインしていて、チュートリアルが完了済みであるとき",
          When: [
            "ホーム画面で「ポケモンを探しに行く」を押して、クエストを始める",
            "クエスト画面で、先頭に表示された場所を選ぶ",
            "クエスト画面の翻訳の入力欄に、「これはテストの翻訳です」と入力して送信する",
            "クエスト画面で、名前当てをスキップする",
            "クエスト画面でボールを使う",
            "クエスト画面から離れて、図鑑画面を開く",
          ],
          Then: "クエスト画面に遷移し、出題の英文として英単語を含む文が表示され、「ダメージ」が表示され、「捕まえたぞ」か「逃げ出した」のどちらかが表示され、ポケモンの英語名と日本語名と「次のポケモンを探す」が表示され、図鑑画面に見出し「図鑑」が表示される",
        },
      ],
    },
    async ({ page }) => {
      await loginAsTestUserWithTutorialStatus(page, "complete");

      const locationsLoaded = page.waitForResponse(
        (res) =>
          res.url().endsWith("/api/quest/locations") &&
          res.request().method() === "GET",
      );
      await page.getByRole("button", { name: BUTTON.startQuest }).click();
      await expect(page).toHaveURL("/quest");

      const { locations } = (await (
        await locationsLoaded
      ).json()) as QuestLocationsResponse;
      await page.getByRole("button", { name: locations[0].name }).click();

      await expect(page.getByTestId("quest-description")).toHaveText(
        /[A-Za-z]+ [A-Za-z]+/,
      );

      await page
        .getByPlaceholder(PLACEHOLDER.translation)
        .fill("これはテストの翻訳です");
      await page
        .getByRole("button", { name: BUTTON.submitTranslation })
        .click();

      await expect(page.getByText(TEXT.damage)).toBeVisible({
        timeout: SCORE_REVEAL_TIMEOUT_MS,
      });

      await page.getByRole("button", { name: BUTTON.skip }).click();

      await page.getByRole("button", { name: BUTTON.useBall }).click();

      const captured = page.getByText(TEXT.captured);
      const escaped = page.getByText(TEXT.escaped);
      await expect(captured.or(escaped)).toBeVisible();

      await expect(page.getByTestId("captured-name-en")).toBeVisible();
      await expect(page.getByTestId("captured-name-ja")).toBeVisible();
      await expect(
        page.getByRole("button", { name: BUTTON.nextQuest }),
      ).toBeVisible();

      await page.goto("/pokedex");
      await expect(
        page.getByRole("heading", { name: HEADING.pokedex }),
      ).toBeVisible();
    },
  );
});
