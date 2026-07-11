import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'coverage']),
  {
    files: ['**/*.ts'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
    },
    rules: {
      // 日本語テキストの区切りに全角スペース（U+3000）を使用しているため、
      // 文字列リテラル・テンプレートリテラルでは許可する
      "no-irregular-whitespace": ["error", {
        skipStrings: true,
        skipTemplates: true,
      }],
    },
  },
])
