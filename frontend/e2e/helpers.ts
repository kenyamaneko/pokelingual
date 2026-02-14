import type { Page } from "@playwright/test";

export async function completeQuest(page: Page) {
  await page.goto("/quest");
  await page.getByText("Who's That Pokemon?").waitFor();

  // 翻訳入力 → 送信
  await page.getByPlaceholder("日本語を\u3000入力してね").fill("テスト翻訳");
  await page.getByRole("button", { name: /この\u3000ほんやくで/ }).click();

  // スコア表示待ち → 名前スキップ
  await page.getByText("ダメージ").waitFor();
  await page.getByRole("button", { name: /スキップ/ }).click();

  // ボール使用
  await page.getByRole("button", { name: /を\u3000使う/ }).click();

  // 結果表示待ち
  await page.getByRole("button", { name: /つぎの\u3000ぼうけんへ/ }).waitFor();
}
