# ADR-014: テスト名から振る舞いカタログを生成して GitHub Pages に公開する

## ステータス

Accepted

## 結論

テストを読めば仕様が把握できる状態を CI が保つため、テスト実行の結果 (JUnit XML) からテスト名を集めた**振る舞いカタログ**を生成する。main への push ではカタログを GitHub Pages (<https://kenyamaneko.github.io/pokelingual/>) に公開し、PR では job summary に出力してレビューで振る舞いの増減を確認できるようにする。テストの命名規約 (keyandnotes-rules testing.md「テストの命名」) がテスト名を仕様の一文として書くことを求めているため、テスト名の集約がそのまま仕様ドキュメントになる。

## 背景・課題

テストの命名規約により、各テストケース名は「〜のとき、〜すると、〜になる」の仕様の一文として書かれている。しかし各ケース名はテストコードの中に散在しており、仕様の全体像を掴むにはテストファイルを渡り歩く必要があった。テスト名を一覧に集約して人が読める形で公開する仕組みを CI に組み込む (Issue #54)。

## 制約

- private リポジトリでも GitHub Pages のサイト自体は誰でも閲覧できる。カタログの中身はテスト名 (振る舞いの記述) のみで、秘匿情報を含まない
- CI コスト削減方針 (paths-ignore / timeout-minutes / concurrency) に従い、追加ジョブは軽量に保つ

## 詳細

- テスト名の抽出はテスト実行の結果 (JUnit XML) から行う。Vitest (backend / frontend) と Playwright (E2E) の junit レポータを設定ファイルで常時有効化し、ローカルと CI のテスト実行経路を揃える
- `scripts/generate_behavior_catalog.py` が JUnit XML の testcase 名を区切り文字 (Vitest「 > 」・Playwright「 › 」) でグループ連鎖とケース名に復元し、Markdown (job summary 用) と HTML (Pages 用) を描画する
- PR では ci.yml の behavior-catalog ジョブが全テストジョブの JUnit XML をアーティファクト経由で集め、job summary に出力する
- main への push では deploy.yml が test (ci.yml) の後に HTML を GitHub Pages へ deploy する。カタログは prod の仕様を表すため develop では公開しない
- 生成物の冒頭に「テスト済みの振る舞いの一覧であり、仕様の全量ではない」ことを明記する。テストが無い仕様はカタログに現れず、「載っていない = 仕様がない」という誤読を防ぐ
- skip 中のテストは実行されておらず「テスト済み」ではないため、注記を付けて区別する
- 設計判断の Why はカタログに含めず ADR が担う (カタログは What を担う)

## 不採用案

- **テストソースの静的解析でテスト名を抽出する**: `it.each` のプレースホルダのように動的に組み立てるテスト名は、実行しないと確定しない。実行結果からの抽出なら確定済みの名前だけを扱える
- **カタログを docs/ にコミットする**: テストを変更するたびに生成物のコミットが必要になり、実装と生成物の二重管理になる。CI の成果物として都度生成する

## Amendment: 2026-07-11 GitHub Flow 移行に伴う表記の訂正

詳細にある「main への push では deploy.yml が... カタログは prod の仕様を表すため develop では公開しない」は、develop 廃止・main 一本化 (GitHub Flow 移行) 以前の表記であり、現在は次の通り読み替える。

- `deploy.yml` は `deploy-dev.yml` と `deploy-prod.yml` に分割されている (ADR-015)
- カタログが表すのは main マージ時点の仕様である。main への push は dev 環境へのデプロイをトリガーするものであり、prod への反映はタグ push で別に行われる。カタログの公開はテスト実行に紐づいて起きるため、prod のデプロイ状況とは独立している

## Amendment: 2026-07-12 テスト観点カタログへの改称と読者別カテゴリの追加

名称を**振る舞いカタログ**から**テスト観点カタログ**に改める。backend のテストを「API を使う人」向けと「backend 開発者」向けに分ける裁定 (test-name-remediation.md) を機に、frontend・E2E も含めた全セクションを次の 2 カテゴリに整理した。

- **外から見た振る舞い**: backend API の振る舞い (`router/`, `middleware/`)、frontend、E2E。製品・API の利用者が読める言葉で書く
- **内部の挙動**: backend 内部部品の検証 (`adapter/`, `domain/`, `service/`, `config/`, `util/`)。backend 開発者が読める、部品の契約の言葉で書く

`scripts/generate_behavior_catalog.py` の `--section` は「カテゴリ:セクション名:JUnit XML のパス[:振り分けプレフィクス]」形式に拡張し、1 つの JUnit XML を由来テストファイルのパスで複数セクションに振り分けられるようにした。振り分けプレフィクスに一致しない testcase が残った場合はエラーで停止する (新しいディレクトリが増えたときに黙って未分類のまま出力しないため)。
