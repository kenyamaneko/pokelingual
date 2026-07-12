# Firestore の手動バックアップと復旧手順

定期バックアップと PITR は未導入 (#123 で検討) のため、復旧の起点は本手順で取った export だけになる。データ移行や import など、データを壊しうる操作の前には必ず export を取る。

対象は Firestore に保存されたデータ (ユーザーの捕獲データ・設定など)。進行中のクエストはメモリ内にあり (ADR-003)、バックアップの対象に含まれない。

## バックアップ (export)

初回のみ、export 先のバケットを作る。バケットは Firestore と同じロケーション (asia-northeast1) に作る必要がある。

```bash
gcloud storage buckets create gs://pokelingual-prod-firestore-export \
  --project=pokelingual-prod --location=asia-northeast1 \
  --uniform-bucket-level-access --public-access-prevention=enforced
```

全コレクションを対象に export を実行する。

```bash
gcloud firestore export \
  "gs://pokelingual-prod-firestore-export/$(date +%Y%m%d-%H%M%S)" \
  --project=pokelingual-prod
```

- export は厳密な時点スナップショットではない。export 中に書き込まれたデータは、含まれることも含まれないこともある。
- プロジェクトのオーナー権限で実行すれば追加の権限設定は不要。別プロジェクトのバケットへ export する場合は、Firestore のサービスエージェントにバケットへの書き込み権限が要る。

## 復旧 (import)

1. 復旧前に、現状のデータを別パスへ export する。import は上書きで巻き戻せないため、復旧に失敗したときの戻り先を先に確保する。

2. import を実行する。

   ```bash
   gcloud firestore import \
     "gs://pokelingual-prod-firestore-export/<バックアップのタイムスタンプ>" \
     --project=pokelingual-prod
   ```

import は export に含まれる document を上書きするが、export 後に作られた document は削除しない。export 時点へ完全に戻す必要がある場合は、それ以降に作られた document を特定して手で消す。

## 復旧後の確認

アプリにログインし、図鑑と設定が復元した時点の内容になっていることを画面で確認する。
