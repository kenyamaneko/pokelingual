import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Firestore Emulator はプロセス全体で 1 つの永続化空間を共有するため、
    // テストファイルを並列実行すると beforeEach の clear が他ファイルのデータを巻き込んで race する。
    // ファイル単位の並列化を切ってシリアル実行にする。
    fileParallelism: false,
    // CI ではテスト結果を JUnit XML でも出力し、レポートとして収集可能にする (ローカルは既定のコンソール出力のまま)。
    reporters: process.env.CI ? ["default", "junit"] : ["default"],
    outputFile: { junit: "./test-results/junit.xml" },
  },
});
