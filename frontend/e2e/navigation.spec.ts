import { test, expect } from "@playwright/test";
import { completeTutorialViaApi } from "./helpers";
import { LINK, BUTTON } from "./labels";

// dev では各ページが認証で保護されログインが必要になるため、認証をバイパスする mock モード専用にする。
test.skip(() => process.env.E2E_MODE === "dev", "mock-only spec");

const VIEWPORT_HEIGHT = 800;
const WIDE_VIEWPORT_WIDTH = 1024;
const NARROW_VIEWPORT_WIDTH = 375;

test.beforeEach(async ({ page }) => {
  await completeTutorialViaApi(page);
});

test.describe("ホーム画面のリンクによる画面遷移", () => {
  test.describe("正常系", () => {
    test("チュートリアルが完了済みのとき、「ポケモンを探しに行く」を押すと、クエスト画面に遷移する", async ({
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

test.describe("ヘッダーのリンクによる画面遷移", () => {
  test.describe("正常系", () => {
    test.describe("ホーム画面を表示しているとき", () => {
      test.beforeEach(async ({ page }) => {
        await page.goto("/");
      });

      test("「ぼうけん」を押すと、クエスト画面に遷移する", async ({ page }) => {
        await page.getByRole("link", { name: LINK.navQuest, exact: true }).click();
        await expect(page).toHaveURL("/quest");
      });

      test("「ずかん」を押すと、図鑑画面に遷移する", async ({ page }) => {
        await page.getByRole("link", { name: LINK.navPokedex, exact: true }).click();
        await expect(page).toHaveURL("/pokedex");
      });

      test("「せってい」を押すと、設定画面に遷移する", async ({ page }) => {
        await page.getByRole("link", { name: LINK.settings, exact: true }).click();
        await expect(page).toHaveURL("/settings");
      });

      test("画面幅が狭いとき、メニューボタンを押してから「ぼうけん」を押すと、クエスト画面に遷移する", async ({
        page,
      }) => {
        await page.setViewportSize({ width: NARROW_VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT });

        await page.getByRole("button", { name: BUTTON.menu }).click();
        await page.getByRole("link", { name: LINK.navQuest, exact: true }).click();
        await expect(page).toHaveURL("/quest");
      });
    });

    test.describe("ヘッダーのロゴを押したとき", () => {
      const screens = [
        { screen: "クエスト画面", path: "/quest" },
        { screen: "図鑑画面", path: "/pokedex" },
      ];

      for (const { screen, path } of screens) {
        test(`${screen}を表示しているとき、ホーム画面に遷移する`, async ({ page }) => {
          await page.goto(path);

          await page.getByRole("link", { name: LINK.logo }).click();
          await expect(page).toHaveURL("/");
        });
      }
    });
  });
});

test.describe("ヘッダーのメニューボタン", () => {
  test.describe("正常系", () => {
    test.describe("画面幅が広いとき", () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: WIDE_VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT });
        await page.goto("/");
      });

      test("ヘッダーを表示すると、「ぼうけん」のリンクが表示される", async ({ page }) => {
        await expect(page.getByRole("link", { name: LINK.navQuest, exact: true })).toBeVisible();
      });

      test("ヘッダーを表示すると、メニューボタンは表示されない", async ({ page }) => {
        await expect(page.getByRole("button", { name: BUTTON.menu })).not.toBeVisible();
      });
    });

    test.describe("画面幅が狭いとき", () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: NARROW_VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT });
        await page.goto("/");
      });

      test("ヘッダーを表示すると、メニューボタンが表示される", async ({ page }) => {
        await expect(page.getByRole("button", { name: BUTTON.menu })).toBeVisible();
      });

      test("ヘッダーを表示すると、「ぼうけん」のリンクは表示されない", async ({ page }) => {
        await expect(page.getByRole("link", { name: LINK.navQuest, exact: true })).not.toBeVisible();
      });
    });
  });
});
