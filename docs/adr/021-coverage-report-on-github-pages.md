# ADR-021: テストカバレッジレポートを GitHub Pages に公開する

## ステータス

Accepted

## 結論

main マージ時点のテストカバレッジ（backend / frontend それぞれの vitest v8 カバレッジレポート）を GitHub Pages に公開する。振る舞いカタログ（ADR-014）とは別ページ（`/coverage/backend/`, `/coverage/frontend/`）として配置し、両者を混在させない。

## 背景・課題

振る舞いカタログはテスト済みの振る舞いの一覧を示すが、コードのどの行が実際にテストで実行されたかは示さない。直近のテストと品質の状況をリポジトリ外からも継続的に追えるようにするため、カバレッジも公開する。

## 制約

- ADR-014 と同じ制約（private リポジトリでも Pages は公開・追加ジョブは軽量に保つ）を引き継ぐ
- backend と frontend は別プロセスで計測しており、計測対象ファイルもレポート形式も異なるため単純にはマージできない

## 詳細

- カバレッジ計測は `vitest --coverage`（v8 provider）の既定レポータ（html を含む）をそのまま使う。追加設定は行わない
- ci.yml の backend-test / frontend-test で `npm run test:coverage` を実行し、生成された `coverage/` を `coverage-backend` / `coverage-frontend` の artifact としてアップロードする（retention 1 日、JUnit XML と同じ扱い）
- deploy-dev.yml の Pages 公開ジョブが、振る舞いカタログの生成と同じジョブ内で coverage artifact をダウンロードし、`_site/coverage/backend/` `_site/coverage/frontend/` にそのまま配置する。振る舞いカタログは従来どおり `_site/index.html`（ルート）に置き、既存 URL を変えない
- E2E（Playwright）はブラウザ経由の実行で計装の仕立てが異なるため対象外とする

## 不採用案

- **backend/frontend のカバレッジを 1 レポートにマージする**: マージツールの導入が要り、計測対象ファイルの重複がないため得られる情報が増えない割に複雑さが増す。2 レポートを並置する方が単純
