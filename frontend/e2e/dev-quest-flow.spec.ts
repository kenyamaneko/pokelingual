import { test, expect, type Page } from "@playwright/test";
import { loginViaUi } from "./helpers";
import { BUTTON, HEADING, LINK, PLACEHOLDER, TEXT } from "./labels";
import type { TutorialStatusResponse } from "../../shared/api-types/tutorial";

// 実 Firebase Auth・実バックエンドを使うクラウド Dev 専用。local では実行しない。
test.skip(() => process.env.E2E_MODE !== "dev", "cloud-dev only spec");

/**
 * 検証済みフィクスチャユーザでログインし、チュートリアル完了状態を返す。
 * @param page Playwright の Page。
 * @returns ログイン後に取得したチュートリアル完了フラグ。
 */
async function loginAndGetTutorialCompleted(page: Page): Promise<boolean> {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  // dev では許可リストに常設したメール確認済みフィクスチャユーザの資格情報が必須。
  // 未設定なら誤った対象を叩く前に明示的に失敗させる。
  if (!email || !password) {
    throw new Error("E2E_EMAIL and E2E_PASSWORD must be set for dev mode");
  }

  // ログイン（実 Firebase Auth 成功＋許可リスト通過＋メール確認済みの証明）
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

// フィクスチャユーザは実行間で使い回す実環境のユーザーであり、完了フラグを外部からリセットする
// 手段がない。完了済み (定常状態) では前者のテストが skip され、未完了の初回だけ前者が
// チュートリアルを完了させたのち後者も実行される (workers: 1 のファイル内順次実行が前提)。
// 前者が途中で失敗した場合は後者が skip されるため、失敗は前者側で顕在化する。

test("チュートリアル未完了のとき、チュートリアルを完了すると本番クエストへの導線に切り替わる", async ({
  page,
}) => {
  const tutorialCompleted = await loginAndGetTutorialCompleted(page);
  test.skip(tutorialCompleted, "フィクスチャユーザのチュートリアルは完了済みのため対象外");

  const startQuestLink = page.getByRole("link", { name: LINK.startQuest });
  await startQuestLink.click();
  await expect(page).toHaveURL("/tutorial");

  // チュートリアルは frontend 完結の固定シナリオなので、内容を確定的に検証できる
  await page.getByPlaceholder(PLACEHOLDER.translation).fill("電気タイプのねずみポケモン");
  await page.getByRole("button", { name: BUTTON.submitTranslation }).click();
  await expect(page.getByText("100", { exact: true })).toBeVisible();

  await page.getByPlaceholder(PLACEHOLDER.nameGuess).fill("pikachu");
  await page.getByRole("button", { name: BUTTON.decideName }).click();

  await page.getByRole("button", { name: BUTTON.useBall }).click();
  await expect(page.getByText(TEXT.captured)).toBeVisible();
  await expect(page.getByTestId("captured-name-en")).toHaveText("Pikachu");

  await page.getByRole("button", { name: BUTTON.backToMenu }).click();
  await expect(page).toHaveURL("/");

  // href の描画は非同期のため、DOM ではなく完了記録の反映を待ってから判定する
  await expect(page.getByRole("link", { name: LINK.startQuest })).toHaveAttribute(
    "href",
    "/quest",
  );
});

test("チュートリアル完了済みのとき、クエストを一周すると図鑑まで到達できる", async ({ page }) => {
  const tutorialCompleted = await loginAndGetTutorialCompleted(page);
  test.skip(!tutorialCompleted, "フィクスチャユーザのチュートリアルは未完了のため対象外");

  const questLink = page.getByRole("link", { name: LINK.startQuest });
  await expect(questLink).toHaveAttribute("href", "/quest");
  await questLink.click();
  await expect(page).toHaveURL("/quest");

  // dev はバックエンドが場所候補をランダムに提示するため、mock 版のような固定名選択はできない。
  // 先頭の候補を選んで探索を開始する。
  await page.getByRole("button").first().click();

  await page.getByText(TEXT.questTitle).waitFor();
  // 実 Gemini/PokeAPI の出題は非決定的なので、内容ではなく「空でないこと」だけを検証する
  await expect(page.getByTestId("quest-description")).not.toBeEmpty();

  await page.getByPlaceholder(PLACEHOLDER.translation).fill("これはテストの翻訳です");
  await page.getByRole("button", { name: BUTTON.submitTranslation }).click();

  // 採点結果（実採点のため時間がかかる場合がある）
  await expect(page.getByText(TEXT.damage)).toBeVisible();

  // 出題ポケモンは未知のため名前当てはスキップ
  await page.getByRole("button", { name: BUTTON.skip }).click();

  await page.getByRole("button", { name: BUTTON.useBall }).click();

  // 実環境の捕獲は確率的なため、捕獲・逃走のどちらでも結果カードが出ることまでを仕様とする
  const captured = page.getByText(TEXT.captured);
  const escaped = page.getByText(TEXT.escaped);
  await expect(captured.or(escaped)).toBeVisible();

  await expect(page.getByTestId("captured-name-en")).toBeVisible();
  await expect(page.getByTestId("captured-name-ja")).toBeVisible();
  await expect(page.getByRole("button", { name: BUTTON.nextQuest })).toBeVisible();

  await page.goto("/pokedex");
  await expect(page.getByRole("heading", { name: HEADING.pokedex })).toBeVisible();
});
