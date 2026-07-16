import { defineConfig } from "vitest/config";

// Stryker (mutation testing) 専用の vitest 設定。
// - Firestore Emulator 必須の adapter/repository テストを除外するため include を絞る。
//   これにより FIRESTORE_EMULATOR_HOST 不要で実行できる。
// - Emulator を使わないので fileParallelism: false も不要 (並列化は Stryker 側が管理する)。
// - junit reporter は外す。Stryker がミュータントごとにテストを回すため XML 出力は無意味に上書きされる。
export default defineConfig({
  test: {
    include: ["src/domain/**/*.test.ts", "src/service/**/*.test.ts"],
  },
});
