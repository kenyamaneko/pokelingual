import { test, expect, type Page } from "@playwright/test";
import { loginViaUi } from "./helpers";
import { BUTTON, HEADING, PLACEHOLDER, TEXT } from "./labels";
import type { TutorialStatusResponse } from "../../shared/api-types/tutorial";

test.skip(() => process.env.E2E_MODE !== "dev", "cloud-dev only spec");

const SCORE_REVEAL_TIMEOUT_MS = 30_000;

/**
 * 検証済みのテスト用ユーザーでログインし、チュートリアル完了状態を返す。
 * @returns ログイン後に取得したチュートリアル完了フラグ。
 */
async function loginAndGetTutorialCompleted(page: Page): Promise<boolean> {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  // dev ではメール確認済みのテスト用ユーザーの資格情報が必須のため、未設定なら誤った対象を叩く前に失敗させる。
  if (!email || !password) {
    throw new Error("E2E_EMAIL and E2E_PASSWORD must be set for dev mode");
  }

  const tutorialStatusLoaded = page.waitForResponse(
    (res) => res.url().includes("/api/tutorial-status") && res.request().method() === "GET",
  );
  await loginViaUi(page, email, password);
  await expect(page).toHaveURL("/");
  const tutorialStatusRes = await tutorialStatusLoaded;
  const { tutorial_completed: tutorialCompleted } =
    (await tutorialStatusRes.json()) as TutorialStatusResponse;
  return tutorialCompleted;
}

// テスト用ユーザーは実行間で使い回す実環境のユーザーで完了フラグを外部からリセットできないため、状態に合わないテストは skip する。
test.describe("クエストの進行", () => {
  test.describe("正常系", () => {
    test.describe("dev 環境でメール確認済みのテスト用ユーザーとしてログインしたとき", () => {
      test("チュートリアルが未完了のとき、「ポケモンを探しに行く」を押すとチュートリアル画面に遷移し、チュートリアルを最後まで進めて「メニューに戻る」を押し、もう一度「ポケモンを探しに行く」を押すと、本番のクエスト画面に遷移する", async ({
        page,
      }) => {
        const tutorialCompleted = await loginAndGetTutorialCompleted(page);
        test.skip(tutorialCompleted, "テスト用ユーザーのチュートリアルは完了済みのため対象外");

        await page.getByRole("button", { name: BUTTON.startQuest }).click();
        await expect(page).toHaveURL("/tutorial");
        await page.getByRole("button", { name: BUTTON.startTutorial }).click();

        await page.getByPlaceholder(PLACEHOLDER.translation).fill("電気タイプのねずみポケモン");
        await page.getByRole("button", { name: BUTTON.submitTranslation }).click();
        await expect(page.getByTestId("damage-value")).toHaveText("99%");

        await page.getByPlaceholder(PLACEHOLDER.nameGuess).fill("pikachu");
        await page.getByRole("button", { name: BUTTON.decideName }).click();
        await page.getByRole("button", { name: BUTTON.proceed }).click();

        await page.getByRole("button", { name: BUTTON.useBall }).click();
        await expect(page.getByText(TEXT.captured)).toBeVisible();
        await expect(page.getByTestId("captured-name-en")).toHaveText("Pikachu");
        await expect(page.getByText(TEXT.tutorialComplete)).toBeVisible();

        await page.getByRole("button", { name: BUTTON.backToMenu }).click();
        await expect(page).toHaveURL("/");

        await page.getByRole("button", { name: BUTTON.startQuest }).click();
        await expect(page).toHaveURL("/quest");
      });

      test("チュートリアルが完了済みのとき、「ポケモンを探しに行く」を押して場所を選ぶと英文が表示され、翻訳を送信するとダメージが表示され、名前当てをスキップしてボールを使うと、捕獲か逃走の結果画面が表示され、図鑑画面を開くと見出しが表示される", async ({
        page,
      }) => {
        const tutorialCompleted = await loginAndGetTutorialCompleted(page);
        test.skip(!tutorialCompleted, "テスト用ユーザーのチュートリアルは未完了のため対象外");

        await page.getByRole("button", { name: BUTTON.startQuest }).click();
        await expect(page).toHaveURL("/quest");

        // dev はバックエンドが場所候補をランダムに提示するため、先頭の候補を選ぶ。
        await page.getByRole("button").first().click();

        await page.getByTestId("quest-description").waitFor();
        // 出題されるポケモンが実行ごとに異なるため、英文の内容ではなく空でないことだけを確かめる。
        await expect(page.getByTestId("quest-description")).not.toBeEmpty();

        await page.getByPlaceholder(PLACEHOLDER.translation).fill("これはテストの翻訳です");
        await page.getByRole("button", { name: BUTTON.submitTranslation }).click();

        // 実 Gemini の採点レイテンシに採点演出の順次表示が続き、既定の 5 秒では「ダメージ」の表示に間に合わないことがあるため、待ち時間を延ばす。
        await expect(page.getByText(TEXT.damage)).toBeVisible({ timeout: SCORE_REVEAL_TIMEOUT_MS });

        // 出題されるポケモンが事前に分からないため、名前当てはスキップする。
        await page.getByRole("button", { name: BUTTON.skip }).click();

        await page.getByRole("button", { name: BUTTON.useBall }).click();

        // 実環境の捕獲は確率的なため、捕獲・逃走のどちらでも結果画面が表示されることを確かめる。
        const captured = page.getByText(TEXT.captured);
        const escaped = page.getByText(TEXT.escaped);
        await expect(captured.or(escaped)).toBeVisible();

        await expect(page.getByTestId("captured-name-en")).toBeVisible();
        await expect(page.getByTestId("captured-name-ja")).toBeVisible();
        await expect(page.getByRole("button", { name: BUTTON.nextQuest })).toBeVisible();

        await page.goto("/pokedex");
        await expect(page.getByRole("heading", { name: HEADING.pokedex })).toBeVisible();
      });
    });
  });
});
