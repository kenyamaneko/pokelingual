import { test, expect } from "@playwright/test";
import { PLACEHOLDER } from "./labels";

// mock モード専用。dev は dev-quest-flow.spec.ts が担当。
// 「チュートリアルを見る」導線と同じ /tutorial への直接遷移を使うため、tutorial_completed の
// 状態に依存しない (他 spec の完了操作の前後どちらで実行しても影響を受けない)。

test.skip(() => process.env.E2E_MODE === "dev", "mock-only spec");

test("案内の吹き出しが表示されている間も、訳文・名前の入力欄を操作できる", async ({ page }) => {
  await page.goto("/tutorial");

  const translationInput = page.getByPlaceholder(PLACEHOLDER.translation);
  await page.getByText("この英文を訳してみよう").waitFor();
  // click は要素が他の要素に覆われていないかを検査するため、fill だけでは検出できない
  // 「吹き出しが入力欄を覆っている」という回帰をここで検出できる
  await translationInput.click();
  await translationInput.fill("電気タイプのねずみポケモン");
  await expect(translationInput).toHaveValue("電気タイプのねずみポケモン");

  await page.getByRole("button", { name: /この翻訳に決めた/ }).click();
  await expect(page.getByText("100", { exact: true })).toBeVisible();

  const nameInput = page.getByPlaceholder(PLACEHOLDER.nameGuess);
  await page.getByText("このポケモンの名前を当てよう").waitFor();
  await nameInput.click();
  await nameInput.fill("pikachu");
  await expect(nameInput).toHaveValue("pikachu");
});
