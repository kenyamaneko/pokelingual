# Pokelingual フロントエンド

Pokelingual の Web クライアント。React + TypeScript + Vite で、英語の図鑑説明文を訳して名前を当て、ポケモンを捕獲するゲーム画面を提供する。

セットアップと全体構成はルートの [README](../README.md) を参照。ここではフロントエンド単体の動かし方だけをまとめる。

## 動かす

バックエンドと Firestore Emulator ごと mock モードで立ち上げる Docker Compose を推奨する。ルートで実行する：

```bash
make dev   # フロントエンド http://localhost:15151 / バックエンド http://localhost:15100
```

Vite 開発サーバーだけを動かす場合は、このディレクトリで実行する：

```bash
npm install
npm run dev
```

## テスト

```bash
npx vitest run   # 単体・コンポーネントテスト（Vitest + Testing Library）
npm run e2e      # E2E テスト（Playwright、local mock。未起動なら docker-compose を自動起動）
npm run lint     # ESLint
```
