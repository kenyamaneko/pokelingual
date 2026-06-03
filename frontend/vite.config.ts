import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // 上位ディレクトリ ../shared/api-types/*.d.ts を読み込めるよう許可。
  // 型のみの import で実行時には何も bundle されないが、Vite の fs ガードは事前に効くため明示する。
  server: { fs: { allow: [".."] } },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: false,
    exclude: ['e2e/**', 'node_modules/**'],
    env: {
      VITE_APP_MODE: 'mock',
    },
  },
})
