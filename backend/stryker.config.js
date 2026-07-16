/** @type {import('@stryker-mutator/core').PartialStrykerOptions} */
const config = {
  // 変異対象は純粋ロジックの 4 ファイルに固定する (Issue #175)。
  // Firestore Emulator や外部 API に依存する層は対象外。
  mutate: [
    "src/domain/generation.ts",
    "src/domain/exclusion.ts",
    "src/domain/legendary.ts",
    "src/service/quest-service.ts",
  ],
  testRunner: "vitest",
  vitest: {
    // Emulator 依存テストを含まない専用 config を使う (junit reporter も外す)
    configFile: "vitest.stryker.config.ts",
  },
  reporters: ["clear-text", "progress", "html"],
  // break は設定しない = report-only。baseline 確立後に別 PR で gate 化を検討する。
  thresholds: { high: 80, low: 60 },
  // sandbox (.stryker-tmp) へのコピー対象から生成物を除外して起動を速くする
  ignorePatterns: ["dist", "coverage", "test-results"],
};
export default config;
