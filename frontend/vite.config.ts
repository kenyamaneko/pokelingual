import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // port/strictPort: 素の npm run dev / preview を compose・Playwright と同じ 15151 に固定する (docs/adr/023)。
  //   strictPort で 15151 が塞がっていれば黙って別ポートに逃げず起動失敗させ、ポート統一の意図を守る。
  // fs.allow: 上位ディレクトリ ../shared/api-types/*.d.ts を読み込めるよう許可。
  //   型のみの import で実行時には何も bundle されないが、Vite の fs ガードは事前に効くため明示する。
  server: { port: 15151, strictPort: true, fs: { allow: [".."] } },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: false,
    exclude: ['e2e/**', 'node_modules/**'],
    // Playwright の e2e-junit.xml と同じ test-results/ に置くため、ファイル名で区別する。
    reporters: ['default', ['junit', { outputFile: 'test-results/vitest-junit.xml' }]],
    env: {
      VITE_APP_MODE: 'mock',
      // MSW が絶対 URL でマッチできるよう API のベース URL を固定する (client.ts の baseURL 前置に使われる)。
      VITE_API_BASE_URL: 'http://localhost:3000',
    },
  },
})
