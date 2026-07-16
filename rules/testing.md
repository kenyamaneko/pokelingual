> NOTE: このファイルは原則として人間が運用する。例外的に許可があった場合のみClaude Codeが修正しても良い。

# pokelingual テスト固有ルール (overlay)

## [pokelingual] テストデータ

- 共通ルールの「本番の実データ ID をそのまま使わない」は本リポでは適用しない。図鑑番号・名前・タイプ・種族値・説明文を含め、公開済みのポケモンデータはゲームの仕様として後から変わることが実質的に無いため、テストでも実データをそのまま使ってよい

## [pokelingual] テスト名と振る舞いカタログ

- テスト名は振る舞いカタログ (GitHub Pages) の仕様文としてそのまま公開される。カタログは「backend（API仕様）」「backend（内部仕様）」「frontend（画面仕様）」「frontend（内部仕様）」「E2E」の読者別セクションで構成する
  - backend（API仕様）: `router/`、`middleware/`
  - backend（内部仕様） (共通ルールの「内部の境界」に当たる区分): `adapter/`、`domain/`、`service/`、`config/`、`util/`、`scripts/` (カタログ生成スクリプト自身のテスト)
  - frontend（内部仕様） (画面に対応物の無い内部配線): `api/`
  - frontend（画面仕様）: `api/` 以外の frontend テストディレクトリ (`App`、`components/`、`contexts/`、`hooks/`、`pages/`、`utils/`)
  - 例外: 外部 API の応答構造そのものを検証する防御テスト (Gemini・PokeAPI アダプタ) に限り、応答フィールド名で Given を書いてよい (構造の検証がそのテストの仕様そのもののため)
  - 新しいテストディレクトリを作ったら、カタログ生成のセクション振り分けに追加する (振り分け漏れは生成エラーになる)
- 共通ルールの識別子の線引き (`testing.md` 参照) を本リポで具体化する: そのまま使ってよいのは環境変数名とその値 (APP_MODE、mock / real 等)・構造化ログのキー名 (ログ出力が仕様対象のときに限る)。言い換える対象は shared/api-types のフィールド名 (kind、ball_type 等)・外部 API (Gemini・PokeAPI) の応答フィールド名・locale コード (ja-Hrkt 等)
- カタログの検収では、生成した Markdown を文脈の無い別セッションの LLM に読者として渡し、「意味の取れない語・観測点の無い文・仕様か疑わしい数値」を列挙させる監査を通す
