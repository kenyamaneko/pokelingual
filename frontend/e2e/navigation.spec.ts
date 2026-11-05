import { test, expect, type Page } from "@playwright/test";
import { completeTutorialViaApi } from "./helpers";
import { LINK, BUTTON } from "./labels";
import { defineCase } from "./defineCase";
import type { DailyUsage } from "../../shared/api-types/usage";
import type { TutorialStatusResponse } from "../../shared/api-types/tutorial";

test.skip(() => process.env.E2E_MODE === "dev", "mock-only spec");

const VIEWPORT_HEIGHT = 800;
const WIDE_VIEWPORT_WIDTH = 1024;
const NARROW_VIEWPORT_WIDTH = 375;

async function openHomeWithViewportWidth(page: Page, width: number) {
  await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
  await page.goto("/");
}

async function mockCompletedTutorialAndUsage(page: Page) {
  const tutorialStatus: TutorialStatusResponse = { tutorial_completed: true };
  const usage: DailyUsage = { count: 0, limit: 50 };
  await page.route("**/api/tutorial-status", (route) =>
    route.fulfill({ json: tutorialStatus }),
  );
  await page.route("**/api/usage", (route) => route.fulfill({ json: usage }));
}

const TUTORIAL_COMPLETED_AT_HOME = "チュートリアルが完了済みで、ホーム画面を表示しているとき";

test.describe("[本体:共通画面]リンクによる画面遷移", () => {
  test.beforeEach(async ({ page }) => {
    await completeTutorialViaApi(page);
  });

  defineCase(
    {
      種別: "E2Eテスト",
      正常異常: "正常系",
      steps: [
        {
          Given: TUTORIAL_COMPLETED_AT_HOME,
          When: ["画面遷移のために、ホーム画面の「ポケモンを探しに行く」ボタンを押す"],
          Then: "クエスト画面に遷移する",
        },
      ],
    },
    async ({ page }) => {
      await page.goto("/");

      await page.getByRole("button", { name: BUTTON.startQuest }).click();
      await expect(page).toHaveURL("/quest");
    },
  );

  defineCase(
    {
      種別: "E2Eテスト",
      正常異常: "正常系",
      steps: [
        {
          Given: TUTORIAL_COMPLETED_AT_HOME,
          When: ["画面遷移のために、ホーム画面の「図鑑を見る」リンクを押す"],
          Then: "図鑑画面に遷移する",
        },
      ],
    },
    async ({ page }) => {
      await page.goto("/");

      await page.getByRole("link", { name: LINK.viewPokedex }).click();
      await expect(page).toHaveURL("/pokedex");
    },
  );

  defineCase(
    {
      種別: "E2Eテスト",
      正常異常: "正常系",
      steps: [
        {
          Given: TUTORIAL_COMPLETED_AT_HOME,
          When: ["画面遷移のために、ホーム画面のヘッダーの「ぼうけん」リンクを押す"],
          Then: "クエスト画面に遷移する",
        },
      ],
    },
    async ({ page }) => {
      await page.goto("/");

      await page
        .getByRole("link", { name: LINK.navQuest, exact: true })
        .click();
      await expect(page).toHaveURL("/quest");
    },
  );

  defineCase(
    {
      種別: "E2Eテスト",
      正常異常: "正常系",
      steps: [
        {
          Given: TUTORIAL_COMPLETED_AT_HOME,
          When: ["画面遷移のために、ホーム画面のヘッダーの「ずかん」リンクを押す"],
          Then: "図鑑画面に遷移する",
        },
      ],
    },
    async ({ page }) => {
      await page.goto("/");

      await page
        .getByRole("link", { name: LINK.navPokedex, exact: true })
        .click();
      await expect(page).toHaveURL("/pokedex");
    },
  );

  defineCase(
    {
      種別: "E2Eテスト",
      正常異常: "正常系",
      steps: [
        {
          Given: TUTORIAL_COMPLETED_AT_HOME,
          When: ["画面遷移のために、ホーム画面のヘッダーの「せってい」リンクを押す"],
          Then: "設定画面に遷移する",
        },
      ],
    },
    async ({ page }) => {
      await page.goto("/");

      await page
        .getByRole("link", { name: LINK.settings, exact: true })
        .click();
      await expect(page).toHaveURL("/settings");
    },
  );

  defineCase(
    {
      種別: "E2Eテスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "チュートリアルが完了済みで、ホーム画面を表示していて、画面幅が狭いとき",
          When: ["ホーム画面のヘッダーのメニューボタンを押す", "画面遷移のために、ホーム画面のヘッダーのメニューの「ぼうけん」リンクを押す"],
          Then: "クエスト画面に遷移する",
        },
      ],
    },
    async ({ page }) => {
      await page.goto("/");
      await page.setViewportSize({
        width: NARROW_VIEWPORT_WIDTH,
        height: VIEWPORT_HEIGHT,
      });

      await page.getByRole("button", { name: BUTTON.menu }).click();
      await page
        .getByRole("link", { name: LINK.navQuest, exact: true })
        .click();
      await expect(page).toHaveURL("/quest");
    },
  );

  for (const { screen, path } of [
    { screen: "クエスト画面", path: "/quest" },
    { screen: "図鑑画面", path: "/pokedex" },
  ]) {
    defineCase(
      {
        種別: "E2Eテスト",
        正常異常: "正常系",
        steps: [
          {
            Given: `チュートリアルが完了済みで、${screen}を表示しているとき`,
            When: [`画面遷移のために、${screen}のヘッダーのロゴ「Pokelingual」を押す`],
            Then: "ホーム画面に遷移する",
          },
        ],
      },
      async ({ page }) => {
        await page.goto(path);

        await page.getByRole("link", { name: LINK.logo }).click();
        await expect(page).toHaveURL("/");
      },
    );
  }
});

test.describe("[本体:共通画面]画面幅に応じたヘッダーの表示", () => {
  test.beforeEach(async ({ page }) => {
    await mockCompletedTutorialAndUsage(page);
  });

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "チュートリアルが完了済みで、画面幅が広いとき",
          When: ["ホーム画面を開いて、画面幅に応じたヘッダーを表示する"],
          Then: "「ぼうけん」のリンクが表示される",
        },
      ],
    },
    async ({ page }) => {
      await openHomeWithViewportWidth(page, WIDE_VIEWPORT_WIDTH);

      await expect(
        page.getByRole("link", { name: LINK.navQuest, exact: true }),
      ).toBeVisible();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "チュートリアルが完了済みで、画面幅が広いとき",
          When: ["ホーム画面を開いて、画面幅に応じたヘッダーを表示する"],
          Then: "メニューボタンは表示されない",
        },
      ],
    },
    async ({ page }) => {
      await openHomeWithViewportWidth(page, WIDE_VIEWPORT_WIDTH);

      await expect(
        page.getByRole("button", { name: BUTTON.menu }),
      ).not.toBeVisible();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "チュートリアルが完了済みで、画面幅が狭いとき",
          When: ["ホーム画面を開いて、画面幅に応じたヘッダーを表示する"],
          Then: "メニューボタンが表示される",
        },
      ],
    },
    async ({ page }) => {
      await openHomeWithViewportWidth(page, NARROW_VIEWPORT_WIDTH);

      await expect(
        page.getByRole("button", { name: BUTTON.menu }),
      ).toBeVisible();
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "チュートリアルが完了済みで、画面幅が狭いとき",
          When: ["ホーム画面を開いて、画面幅に応じたヘッダーを表示する"],
          Then: "「ぼうけん」のリンクは表示されない",
        },
      ],
    },
    async ({ page }) => {
      await openHomeWithViewportWidth(page, NARROW_VIEWPORT_WIDTH);

      await expect(
        page.getByRole("link", { name: LINK.navQuest, exact: true }),
      ).not.toBeVisible();
    },
  );
});
