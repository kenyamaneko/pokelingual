import { test, expect, type Page } from "@playwright/test";
import { completeTutorialViaApi } from "./helpers";
import { LINK, BUTTON } from "./labels";
import type { DailyUsage } from "../../shared/api-types/usage";
import type { TutorialStatusResponse } from "../../shared/api-types/tutorial";

test.skip(() => process.env.E2E_MODE === "dev", "mock-only spec");

const VIEWPORT_HEIGHT = 800;
const WIDE_VIEWPORT_WIDTH = 1024;
const NARROW_VIEWPORT_WIDTH = 375;

async function mockCompletedTutorialAndUsage(page: Page) {
  const tutorialStatus: TutorialStatusResponse = { tutorial_completed: true };
  const usage: DailyUsage = { count: 0, limit: 50 };
  await page.route("**/api/tutorial-status", (route) =>
    route.fulfill({ json: tutorialStatus }),
  );
  await page.route("**/api/usage", (route) => route.fulfill({ json: usage }));
}

test.describe("[本体:ホーム画面]リンクによる画面遷移", () => {
  test.describe("チュートリアルが完了済みのとき", () => {
    test.beforeEach(async ({ page }) => {
      await completeTutorialViaApi(page);
    });

    test.describe("E2Eテスト", () => {
      test.describe("正常系", () => {
        test("「ポケモンを探しに行く」を押すと、クエスト画面に遷移する", async ({
          page,
        }) => {
          await page.goto("/");

          await page.getByRole("button", { name: BUTTON.startQuest }).click();
          await expect(page).toHaveURL("/quest");
        });

        test("「図鑑を見る」を押すと、図鑑画面に遷移する", async ({ page }) => {
          await page.goto("/");

          await page.getByRole("link", { name: LINK.viewPokedex }).click();
          await expect(page).toHaveURL("/pokedex");
        });
      });
    });
  });
});

test.describe("[本体:ヘッダー]リンクによる画面遷移", () => {
  test.describe("チュートリアルが完了済みのとき", () => {
    test.beforeEach(async ({ page }) => {
      await completeTutorialViaApi(page);
    });

    test.describe("ホーム画面を表示しているとき", () => {
      test.beforeEach(async ({ page }) => {
        await page.goto("/");
      });

      test.describe("E2Eテスト", () => {
        test.describe("正常系", () => {
          test("「ぼうけん」を押すと、クエスト画面に遷移する", async ({
            page,
          }) => {
            await page
              .getByRole("link", { name: LINK.navQuest, exact: true })
              .click();
            await expect(page).toHaveURL("/quest");
          });

          test("「ずかん」を押すと、図鑑画面に遷移する", async ({ page }) => {
            await page
              .getByRole("link", { name: LINK.navPokedex, exact: true })
              .click();
            await expect(page).toHaveURL("/pokedex");
          });

          test("「せってい」を押すと、設定画面に遷移する", async ({ page }) => {
            await page
              .getByRole("link", { name: LINK.settings, exact: true })
              .click();
            await expect(page).toHaveURL("/settings");
          });

          test("画面幅が狭いとき、メニューボタンを押してから「ぼうけん」を押すと、クエスト画面に遷移する", async ({
            page,
          }) => {
            await page.setViewportSize({
              width: NARROW_VIEWPORT_WIDTH,
              height: VIEWPORT_HEIGHT,
            });

            await page.getByRole("button", { name: BUTTON.menu }).click();
            await page
              .getByRole("link", { name: LINK.navQuest, exact: true })
              .click();
            await expect(page).toHaveURL("/quest");
          });
        });
      });
    });

    test.describe("ヘッダーのロゴ「Pokelingual」を押すと", () => {
      test.describe("E2Eテスト", () => {
        test.describe("正常系", () => {
          const screens = [
            { screen: "クエスト画面", path: "/quest" },
            { screen: "図鑑画面", path: "/pokedex" },
          ];

          for (const { screen, path } of screens) {
            test(`${screen}を表示しているとき、ホーム画面に遷移する`, async ({
              page,
            }) => {
              await page.goto(path);

              await page.getByRole("link", { name: LINK.logo }).click();
              await expect(page).toHaveURL("/");
            });
          }
        });
      });
    });
  });
});

test.describe("[本体:ヘッダー]画面幅に応じたヘッダーの表示", () => {
  test.describe("チュートリアルが完了済みのとき", () => {
    test.beforeEach(async ({ page }) => {
      await mockCompletedTutorialAndUsage(page);
    });

    test.describe("画面幅が広いとき", () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({
          width: WIDE_VIEWPORT_WIDTH,
          height: VIEWPORT_HEIGHT,
        });
        await page.goto("/");
      });

      test.describe("ヘッダーを表示すると", () => {
        test.describe("部品間結合テスト", () => {
          test.describe("正常系", () => {
            test("「ぼうけん」のリンクが表示される", async ({ page }) => {
              await expect(
                page.getByRole("link", { name: LINK.navQuest, exact: true }),
              ).toBeVisible();
            });

            test("メニューボタンは表示されない", async ({ page }) => {
              await expect(
                page.getByRole("button", { name: BUTTON.menu }),
              ).not.toBeVisible();
            });
          });
        });
      });
    });

    test.describe("画面幅が狭いとき", () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({
          width: NARROW_VIEWPORT_WIDTH,
          height: VIEWPORT_HEIGHT,
        });
        await page.goto("/");
      });

      test.describe("ヘッダーを表示すると", () => {
        test.describe("部品間結合テスト", () => {
          test.describe("正常系", () => {
            test("メニューボタンが表示される", async ({ page }) => {
              await expect(
                page.getByRole("button", { name: BUTTON.menu }),
              ).toBeVisible();
            });

            test("「ぼうけん」のリンクは表示されない", async ({ page }) => {
              await expect(
                page.getByRole("link", { name: LINK.navQuest, exact: true }),
              ).not.toBeVisible();
            });
          });
        });
      });
    });
  });
});
