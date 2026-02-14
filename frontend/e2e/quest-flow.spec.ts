import { test, expect } from "@playwright/test";

test("クエスト全フロー（翻訳 → 採点 → 名前当て → 捕獲 → 結果）", async ({
  page,
}) => {
  // ホームページからクエスト開始
  await page.goto("/");
  await page.getByRole("link", { name: /ぼうけんに\u3000出かける/ }).click();
  await expect(page).toHaveURL("/quest");

  // クエストカードが表示される
  await page.getByText("Who's That Pokemon?").waitFor();
  const description = page.locator("p.italic");
  await expect(description).not.toBeEmpty();

  // 翻訳入力 → 送信
  await page
    .getByPlaceholder("日本語を\u3000入力してね")
    .fill("テスト翻訳です");
  await page.getByRole("button", { name: /この\u3000ほんやくで/ }).click();

  // スコア表示を確認
  await expect(page.getByText("ダメージ")).toBeVisible();

  // 博士からのコメントを確認
  await expect(page.getByText("はかせからの\u3000コメント")).toBeVisible();

  // 名前推測: mock モードでは Pikachu, Bulbasaur, Charmander, Squirtle, Mewtwo のいずれか
  // "pikachu" で試す（当たらなくても3回で終了）
  const nameInput = page.getByPlaceholder("ポケモンの\u3000名前を\u3000入力してね");
  await nameInput.fill("pikachu");
  await page.getByRole("button", { name: /きみに\u3000きめた/ }).click();

  // 名前当て結果が表示される（せいかい or はずれ）
  const correct = page.getByText("せいかい！");
  const wrong = page.getByText(/はずれ/);
  await expect(correct.or(wrong)).toBeVisible();

  // スキップで次へ進む（不正解の場合もあるため）
  await page.getByRole("button", { name: /次へ\u3000すすむ|スキップ/ }).click();

  // ボール画面
  await page.getByRole("button", { name: /を\u3000使う/ }).click();

  // 捕獲結果 → ポケモン名が表示される
  const captured = page.getByText(/つかまえたぞ/);
  const escaped = page.getByText(/にげだした/);
  await expect(captured.or(escaped)).toBeVisible();

  // ポケモンの英語名と日本語名が表示される
  await expect(page.locator("p.text-xl.font-bold.text-gray-800")).toBeVisible();
  await expect(page.locator("p.text-gray-500").first()).toBeVisible();

  // 次のクエストへのボタンが表示される
  await expect(
    page.getByRole("button", { name: /つぎの\u3000ぼうけんへ/ })
  ).toBeVisible();
});

test("翻訳スキップ → 名前スキップの最短フロー", async ({ page }) => {
  await page.goto("/quest");
  await page.getByText("Who's That Pokemon?").waitFor();

  // 最低限の翻訳を入力
  await page.getByPlaceholder("日本語を\u3000入力してね").fill("テスト");
  await page.getByRole("button", { name: /この\u3000ほんやくで/ }).click();

  // スコア表示
  await expect(page.getByText("ダメージ")).toBeVisible();

  // 名前スキップ
  await page.getByRole("button", { name: /スキップ/ }).click();

  // ボール使用
  await page.getByRole("button", { name: /を\u3000使う/ }).click();

  // 結果表示
  const captured = page.getByText(/つかまえたぞ/);
  const escaped = page.getByText(/にげだした/);
  await expect(captured.or(escaped)).toBeVisible();
});
