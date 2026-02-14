import type { Page } from "@playwright/test";

// UI テキストの全角スペース（\u3000）は Playwright がアクセシブル名を
// 正規化する際に半角スペースに変換されるため、正規表現の `.` で任意の
// 空白文字にマッチさせている（例: /この.ほんやくで/ → "この ほんやくで"）
export async function completeQuest(page: Page) {
  await page.goto("/quest");
  await page.getByText("Who's That Pokemon?").waitFor();

  // 翻訳入力 → 送信
  await page.getByPlaceholder(/日本語を.入力してね/).fill("テスト翻訳");
  await page.getByRole("button", { name: /この.ほんやくで/ }).click();

  // スコア表示待ち → 名前スキップ
  await page.getByText("ダメージ").waitFor();
  await page.getByRole("button", { name: /スキップ/ }).click();

  // ボール使用
  await page.getByRole("button", { name: /を.使う/ }).click();

  // 結果表示待ち
  await page.getByRole("button", { name: /つぎの.ぼうけんへ/ }).waitFor();
}
