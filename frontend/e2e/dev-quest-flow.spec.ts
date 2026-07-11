import { test, expect } from "@playwright/test";
import { loginViaUi } from "./helpers";
import { BUTTON, HEADING, LINK, PLACEHOLDER, TEXT } from "./labels";

// 実 Firebase Auth・実バックエンドを使うクラウド Dev 専用。local では実行しない。
test.skip(() => process.env.E2E_MODE !== "dev", "cloud-dev only spec");

test("ログイン → クエスト → 図鑑（クラウド Dev フルフロー）", async ({ page }) => {
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
  await tutorialStatusLoaded;

  // フィクスチャユーザは実行間で使い回すため、チュートリアル完了状態は実行のたびに変わりうる。
  // 未完了ならチュートリアルを通過し、完了済みならスキップする
  const startQuestLink = page.getByRole("link", { name: LINK.startQuest });
  if ((await startQuestLink.getAttribute("href")) === "/tutorial") {
    await startQuestLink.click();
    await expect(page).toHaveURL("/tutorial");

    // チュートリアルは frontend 完結の固定シナリオなので、内容を確定的に検証できる
    await page.getByRole("button", { name: BUTTON.gotIt }).click();
    await page.getByPlaceholder(PLACEHOLDER.translation).fill("電気タイプのねずみポケモン");
    await page.getByRole("button", { name: BUTTON.submitTranslation }).click();
    await expect(page.getByText("100", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: BUTTON.gotIt }).click();
    await page.getByPlaceholder(PLACEHOLDER.nameGuess).fill("pikachu");
    await page.getByRole("button", { name: BUTTON.decideName }).click();

    await page.getByRole("button", { name: BUTTON.useBall }).click();
    await expect(page.getByText(TEXT.captured)).toBeVisible();
    await expect(page.getByTestId("captured-name-en")).toHaveText("Pikachu");

    await page.getByRole("button", { name: BUTTON.backToMenu }).click();
    await expect(page).toHaveURL("/");
  }

  // チュートリアル完了後は、クエスト導線が本番クエストに切り替わる
  // (完了記録の PUT が非同期のため、href の反映を待ってからクリックする)
  const questLink = page.getByRole("link", { name: LINK.startQuest });
  await expect(questLink).toHaveAttribute("href", "/quest");
  await questLink.click();
  await expect(page).toHaveURL("/quest");

  await page.getByText(TEXT.questTitle).waitFor();
  // 実 Gemini/PokeAPI の出題は非決定的なので、内容ではなく「空でないこと」だけを検証する
  await expect(page.getByTestId("quest-description")).not.toBeEmpty();

  // 翻訳入力 → 送信
  await page.getByPlaceholder(PLACEHOLDER.translation).fill("これはテストの翻訳です");
  await page.getByRole("button", { name: BUTTON.submitTranslation }).click();

  // 採点結果（実採点のため時間がかかる場合がある）
  await expect(page.getByText(TEXT.damage)).toBeVisible();

  // 出題ポケモンは未知のため名前当てはスキップ
  await page.getByRole("button", { name: BUTTON.skip }).click();

  // ボール使用
  await page.getByRole("button", { name: BUTTON.useBall }).click();

  // 実環境の捕獲は確率的なため、捕獲・逃走のどちらでも結果カードが出ることまでを仕様とする
  const captured = page.getByText(TEXT.captured);
  const escaped = page.getByText(TEXT.escaped);
  await expect(captured.or(escaped)).toBeVisible();

  await expect(page.getByTestId("captured-name-en")).toBeVisible();
  await expect(page.getByTestId("captured-name-ja")).toBeVisible();
  await expect(
    page.getByRole("button", { name: BUTTON.nextQuest })
  ).toBeVisible();

  // 図鑑ページが開けることを確認する。捕獲成否に依存する検証 (カードの有無) は
  // 結果が確率的で分岐になるため行わない。決定的な捕獲→図鑑の検証は mock の pokedex.spec が担う
  await page.goto("/pokedex");
  await expect(page.getByRole("heading", { name: HEADING.pokedex })).toBeVisible();
});
