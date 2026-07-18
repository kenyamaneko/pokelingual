import { defineConfig } from "vitest/config";

// Valkey コンテナ (testcontainers) を要する結合テスト専用の vitest 設定。
// Docker 前提のため、Docker 不要な通常スイート (vitest.config.ts) とは実行系列を分ける。
export default defineConfig({
  test: {
    include: ["src/**/*.integration.test.ts"],
    // コンテナ起動を含むため既定のテストタイムアウトでは不足しうる。
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
