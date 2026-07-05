import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Firestore Emulator はプロセス全体で 1 つの永続化空間を共有するため、
    // テストファイルを並列実行すると beforeEach の clear が他ファイルのデータを巻き込んで race する。
    // ファイル単位の並列化を切ってシリアル実行にする。
    fileParallelism: false,
    // 振る舞いカタログ (docs/adr/014) の生成元としてテスト名を JUnit XML に残す。
    // CI 専用のフラグにせず設定へ置き、ローカルと CI のテスト実行経路を揃える。
    reporters: ["default", ["junit", { outputFile: "test-results/junit.xml" }]],
  },
});
