import { defineConfig } from "vitest/config";

// Stryker (mutation testing) 専用の vitest 設定。Firestore Emulator 必須の adapter/repository テストを
// include から除外し、FIRESTORE_EMULATOR_HOST 不要で実行できるようにする。
export default defineConfig({
  test: {
    include: ["src/domain/**/*.test.ts", "src/service/**/*.test.ts"],
  },
});
