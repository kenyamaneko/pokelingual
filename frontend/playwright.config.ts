import { defineConfig } from "@playwright/test";

// E2E_MODE で実行環境を切り替える。local = ローカル docker-compose（mock）、dev = デプロイ済みクラウド Dev。
const E2E_MODE = process.env.E2E_MODE ?? "local";
const isDev = E2E_MODE === "dev";

const LOCAL_BASE_URL = "http://localhost:15151";
const LOCAL_TIMEOUT_MS = 30_000;
const DEV_TIMEOUT_MS = 90_000; // dev は実 Gemini/PokeAPI を経由するため採点が遅い
const WEBSERVER_TIMEOUT_MS = 120_000;

// dev は本番相当のため localhost へフォールバックさせない。明示の baseURL がなければ local の既定値のみ使う。
const baseURL = process.env.E2E_BASE_URL ?? LOCAL_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  timeout: isDev ? DEV_TIMEOUT_MS : LOCAL_TIMEOUT_MS,
  // mock モードの出題・捕獲を RandomSource で決定化したため、flaky を retry で吸収しない (非決定性を隠さない)。
  retries: 0,
  // mock 認証は全リクエストが同一 uid のため、backend の in-memory クエストセッションを
  // 全テストが共有する。並列実行だと他テストの capture がセッションを消して 404 になるため直列に固定する。
  workers: 1,
  // 振る舞いカタログ (docs/adr/014) の生成元としてテスト名を JUnit XML に残す。
  reporter: [["list"], ["junit", { outputFile: "test-results/e2e-junit.xml" }]],
  // Playwright は実行開始時に outputDir を丸ごと消すため、既定の test-results/ のままだと
  // Vitest の junit (test-results/vitest-junit.xml) を巻き込んで消す。サブディレクトリに隔離する。
  outputDir: "test-results/e2e",
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [{ name: E2E_MODE, use: { browserName: "chromium" } }],
  // dev はデプロイ済み Hosting に対して実行するため webServer は起動しない。
  webServer: isDev
    ? undefined
    : {
        command: "cd .. && docker compose -f docker-compose.dev.yml up --build",
        url: LOCAL_BASE_URL,
        timeout: WEBSERVER_TIMEOUT_MS,
        reuseExistingServer: true,
      },
});
