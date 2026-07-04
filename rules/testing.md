> NOTE: このファイルは原則として人間が運用する。例外的に許可があった場合のみClaude Codeが修正しても良い。

# pokelingual テスト固有ルール (overlay)

共通ルール (`keyandnotes-rules` の `rules/testing.md`) を土台に、pokelingual 固有の具体化を定義する。CLAUDE.md の「ファイル編集前のルール適用手順」に従い、テスト作成時に共通とあわせて Read する。

## [pokelingual] テストデータ

- 「本番の実データ ID をそのまま使わない」共通ルールを本リポで具体化する: 実ポケモンの ID (`pokemon_id` 等) をテストに使わず、テスト専用のダミー ID を用いる
