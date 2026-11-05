import { test, expect, type Page, type Response } from "@playwright/test";
import { loginViaUi } from "./helpers";
import { BUTTON, HEADING, PLACEHOLDER, TEXT } from "./labels";
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

test.describe("[本体:クエスト]クエストの進行", () => {
  test.describe("dev 環境でメール確認済みのテスト用ユーザーとしてログインし、チュートリアルを未完了に戻したとき", () => {
    test.beforeEach(async ({ page }) => {
      const tutorialStatusResponse = await loginAsTestUser(page);
      await setTutorialStatusOfLoggedInUser(
        page,
        tutorialStatusResponse,
        "reset",
      );
    });

    test.describe("スモークテスト", () => {
      test.describe("正常系", () => {
        test("「ポケモンを探しに行く」を押すとチュートリアル画面に遷移し、「はじめる」を押して翻訳「電気タイプのねずみポケモン」を送信するとダメージが「99%」と表示され、名前「pikachu」を入力して「君に決めた」を押し、「次へ進む」を押してボールを使うと、「捕まえたぞ」と、捕まえたポケモンの英語名「Pikachu」と、「これでチュートリアルは完了だよ」の案内が表示され、「メニューに戻る」を押すとホーム画面に遷移し、もう一度「ポケモンを探しに行く」を押すと、クエスト画面に遷移する", async ({
          page,
        }) => {
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
        });
      });
    });
  });

  test.describe("dev 環境でメール確認済みのテスト用ユーザーとしてログインし、チュートリアルを完了済みにしたとき", () => {
    test.beforeEach(async ({ page }) => {
      const tutorialStatusResponse = await loginAsTestUser(page);
      await setTutorialStatusOfLoggedInUser(
        page,
        tutorialStatusResponse,
        "complete",
      );
    });

    test.describe("スモークテスト", () => {
      test.describe("正常系", () => {
        test("「ポケモンを探しに行く」を押してクエスト画面に遷移し、先頭に表示された場所を選ぶと出題の英文として英単語を含む文が表示され、翻訳「これはテストの翻訳です」を送信すると「ダメージ」が表示され、名前当てをスキップしてボールを使うと、「捕まえたぞ」か「逃げ出した」のどちらかが表示され、ポケモンの英語名と日本語名と「次のポケモンを探す」が表示され、図鑑画面を開くと見出し「図鑑」が表示される", async ({
          page,
        }) => {
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
        });
      });
    });
  });
});
