# ADR-021: prod Firestore の復旧手段に PITR を採用する

## ステータス

Accepted

## 結論

prod の Firestore `(default)` データベースに Point-in-Time Recovery (PITR) を有効化する。`google_firestore_database` リソースに属性を1つ追加するだけで、過去7日以内の任意時点への復元が可能になる。dev は使い捨てデータのため対象外にする。

## 背景・課題

prod の Firestore (ユーザーの捕獲データ・設定・チュートリアル完了フラグ等) にはバックアップが存在しない。誤操作や不具合による書き込み破損が起きても、直近に手動 export を取っていない限り復旧できない。

## 詳細

- `google_firestore_database.default` に `point_in_time_recovery_enablement` を設定する。値は新設した `var.pitr_enabled` (default なし) で分岐し、`environments/<env>/terraform.tfvars` で環境ごとに明示指定する (prod のみ true)
- 復元は同じ `(default)` データベースに対する機能のため、復元後のデータ移行や接続先切替が不要
- 保持期間は 7 日固定 (Google Cloud の仕様)。旧バージョンのデータを保持する分、ストレージ課金が増える

## 不採用案

- **Scheduled backups**: `google_firestore_backup_schedule` で保持期間を自由に設定できるが、復元は新しいデータベースとして作られるため、`(default)` 単一データベース前提の現構成では復元後にデータ移行または接続先切替が要る
- **Cloud Scheduler + 定期 export**: 手動 export 手順の自動化はできるが、復元 (import) は上書きマージで、export 後に作成されたデータは残る (完全な時点復元にならない)。Cloud Scheduler・実行環境・GCS バケットなど管理対象も増える
