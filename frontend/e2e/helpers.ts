import { expect, type Page, type Response } from "@playwright/test";
import { byEnvironment } from "./defineCase";
import { BUTTON, PLACEHOLDER } from "./labels";
import type { PokedexResponse } from "../../shared/api-types/pokedex";

/**
 * /login からメール確認済みユーザでログインし、ホームに着地するまでを行う。dev モードの E2E で使う。
 * @param page Playwright の Page。
 * @param email ログインに使うメールアドレス。
 * @param password ログインに使うパスワード。
 */
export async function loginViaUi(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByPlaceholder(PLACEHOLDER.email).fill(email);
  await page.getByPlaceholder(PLACEHOLDER.password).fill(password);
  await page.getByRole("button", { name: BUTTON.login }).click();
  await page.waitForURL("/");
}

const LOCAL_BACKEND_URL = "http://localhost:15100";

/**
 * backend の mock 認証は全リクエストが同一 uid (dev-user) に固定されるため、
 * 対象ユーザーを指定せず直接チュートリアル完了状態を立てる。local (mock) 専用。
 * @param page APIRequestContext を共有する Playwright の Page。
 */
export async function completeTutorialViaApi(page: Page) {
  await page.request.put(`${LOCAL_BACKEND_URL}/api/tutorial-status/complete`);
}

/**
 * チュートリアル完了状態を未完了に戻す。local (mock) 専用。
 * @param page APIRequestContext を共有する Playwright の Page。
 */
export async function resetTutorialStatus(page: Page) {
  await page.request.put(`${LOCAL_BACKEND_URL}/api/tutorial-status/reset`);
}

/**
 * 除外ポケモンの設定を空にリセットする。local (mock) 専用。
 * dev-user の状態が実行間で残るため、テストの再実行を独立させるために使う。
 * @param page APIRequestContext を共有する Playwright の Page。
 */
export async function resetExcludedPokemon(page: Page) {
  await page.request.put(`${LOCAL_BACKEND_URL}/api/settings/excluded-pokemon`, {
    data: { pokemon_ids: [] },
  });
}

/**
 * 図鑑に記録されている、指定したポケモンの捕獲回数を返す。local (mock) 専用。
 * 捕獲回数は実行間で残り、リセットする API が無いため、操作の前後の差で確かめるために使う。
 * @param page APIRequestContext を共有する Playwright の Page。
 * @param pokemonId 図鑑番号。
 * @returns 捕獲回数。まだ遭遇していないポケモンは図鑑に載らないため 0。
 */
export async function countCapturesViaApi(page: Page, pokemonId: number) {
  const res = await page.request.get(`${LOCAL_BACKEND_URL}/api/pokedex`);
  const { pokemon } = (await res.json()) as PokedexResponse;
  return (
    pokemon.find((entry) => entry.pokemon_id === pokemonId)?.total_captures ?? 0
  );
}

const TUTORIAL_STATUS_PATH = "/api/tutorial-status";
const EXCLUDED_POKEMON_PATH = "/api/settings/excluded-pokemon";

/** 採点結果が表示されるまで待つ時間 (ミリ秒)。 */
export const SCORE_REVEAL_TIMEOUT_MS = 30_000;

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
      res.url().includes(TUTORIAL_STATUS_PATH) &&
      res.request().method() === "GET",
  );
  await loginViaUi(page, email, password);
  await expect(page).toHaveURL("/");
  return tutorialStatusLoaded;
}

async function resetExcludedPokemonOfLoggedInUser(
  page: Page,
  tutorialStatusResponse: Response,
) {
  const { authorization } = await tutorialStatusResponse.request().allHeaders();
  const res = await page.request.put(
    new URL(EXCLUDED_POKEMON_PATH, tutorialStatusResponse.url()).toString(),
    {
      headers: { authorization },
      data: { pokemon_ids: [] },
    },
  );
  expect(res.ok()).toBe(true);
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
 * 検証済みのテスト用ユーザーでログインし、チュートリアルを指定の状態にしてホーム画面を読み直す。dev 専用。
 * @param state 用意する状態。完了済みにするなら "complete"、未完了に戻すなら "reset"。
 */
export async function loginAsTestUserWithTutorialStatus(page: Page, state: "complete" | "reset") {
  const tutorialStatusResponse = await loginAsTestUser(page);
  await setTutorialStatusOfLoggedInUser(page, tutorialStatusResponse, state);
}

async function prepareLocalUserWithIncompleteTutorial(page: Page) {
  await resetTutorialStatus(page);
  await page.goto("/");
}

async function prepareDevUserWithIncompleteTutorial(page: Page) {
  await loginAsTestUserWithTutorialStatus(page, "reset");
}

async function prepareLocalUserWithCompletedTutorialAndNoExcludedPokemon(page: Page) {
  await completeTutorialViaApi(page);
  await resetExcludedPokemon(page);
  await page.goto("/");
}

async function prepareDevUserWithCompletedTutorialAndNoExcludedPokemon(page: Page) {
  const tutorialStatusResponse = await loginAsTestUser(page);
  await resetExcludedPokemonOfLoggedInUser(page, tutorialStatusResponse);
  await setTutorialStatusOfLoggedInUser(page, tutorialStatusResponse, "complete");
}

/** ログインしていて、チュートリアルが未完了で、ホーム画面を表示している状態を用意する。 */
export const prepareLoggedInUserWithIncompleteTutorial = byEnvironment({
  ローカル: prepareLocalUserWithIncompleteTutorial,
  dev環境: prepareDevUserWithIncompleteTutorial,
});

/** ログインしていて、チュートリアルが完了済みで、除外ポケモンが未設定で、ホーム画面を表示している状態を用意する。 */
export const prepareLoggedInUserWithCompletedTutorialAndNoExcludedPokemon = byEnvironment({
  ローカル: prepareLocalUserWithCompletedTutorialAndNoExcludedPokemon,
  dev環境: prepareDevUserWithCompletedTutorialAndNoExcludedPokemon,
});

/** mock の採点で表示されうるダメージ (%) の下限。素点の下限 20 を最終評価点に変換した値。 */
export const MOCK_DAMAGE_PERCENT_MIN = 11;
/** mock の採点で表示されうるダメージ (%) の上限。素点の上限 95 を最終評価点に変換した値。 */
export const MOCK_DAMAGE_PERCENT_MAX = 94;

/**
 * 採点結果に表示されているダメージ (%) を数値で返す。表示が出揃うまで待つ。
 * @param page Playwright の Page。
 * @returns ダメージ (%)。
 */
export async function readDamagePercent(page: Page) {
  const damage = page.getByTestId("damage-value");
  await expect(damage).toHaveText(/^\d+%$/);
  return Number.parseInt(await damage.innerText(), 10);
}

/**
 * クエストを1回完走させる（翻訳→採点→名前スキップ→捕獲→結果カード表示まで）。
 * @param page Playwright の Page。
 * @returns 採点で表示されたダメージ (%)。
 */
export async function completeQuest(page: Page) {
  await page.goto("/quest");
  // 場所選択で「廃墟の発電所」(でんき) を選ぶと、mock では決定的にピカチュウが出る
  await page.getByRole("button", { name: BUTTON.selectPowerPlant }).click();
  await page.getByTestId("quest-description").waitFor();

  // 翻訳入力 → 送信
  await page.getByPlaceholder(PLACEHOLDER.translation).fill("テスト翻訳");
  await page.getByRole("button", { name: BUTTON.submitTranslation }).click();

  // スコア表示待ち → 名前スキップ
  const damagePercent = await readDamagePercent(page);
  await page.getByRole("button", { name: BUTTON.skip }).click();

  // ボール使用
  await page.getByRole("button", { name: BUTTON.useBall }).click();

  // 結果表示待ち
  await page.getByRole("button", { name: BUTTON.nextQuest }).waitFor();
  return damagePercent;
}
