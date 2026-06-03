import { test, expect } from "@playwright/test";
import { registerViaUi } from "./helpers";
import { BUTTON, HEADING, LINK, PLACEHOLDER, TEXT } from "./labels";

// 実 Firebase Auth・実バックエンドを使うクラウド Dev 専用。local では実行しない。
test.skip(() => process.env.E2E_MODE !== "dev", "cloud-dev only spec");

test("新規登録 → クエスト → 図鑑（クラウド Dev フルフロー）", async ({ page }) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  // dev では本番相当の資格情報が必須。未設定なら誤った対象を叩く前に明示的に失敗させる。
  if (!email || !password) {
    throw new Error("E2E_EMAIL and E2E_PASSWORD must be set for dev mode");
  }

  // 新規登録 → 認証済みでホームに着地（実 Firebase Auth 成功＋許可リスト通過の証明）
  await registerViaUi(page, email, password);
  await expect(page).toHaveURL("/");

  // クエスト開始
  await page.getByRole("link", { name: LINK.startQuest }).click();
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

  // 捕獲は確率的。捕獲・逃走どちらでも結果カードが出ることを確認する
  const captured = page.getByText(TEXT.captured);
  const escaped = page.getByText(TEXT.escaped);
  await expect(captured.or(escaped)).toBeVisible();
  const isCaptured = await captured.isVisible();

  await expect(page.getByTestId("captured-name-en")).toBeVisible();
  await expect(page.getByTestId("captured-name-ja")).toBeVisible();
  await expect(
    page.getByRole("button", { name: BUTTON.nextQuest })
  ).toBeVisible();

  // 図鑑へ。捕獲できた場合のみカードの存在を確認する（逃走時は空のことがある）
  await page.goto("/collection");
  await expect(page.getByRole("heading", { name: HEADING.collection })).toBeVisible();
  if (isCaptured) {
    await expect(page.getByTestId("pokemon-card").first()).toBeVisible();
  }
});
