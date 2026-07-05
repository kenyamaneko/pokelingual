# ADR-006: dev 環境の結合テスト + 自動ロールバック

## ステータス

Accepted

## 結論

dev 環境が壊れたまま放置されるのを防ぐため、develop ブランチのデプロイ後に結合テストを実行し、失敗時は自動ロールバックする。main ブランチ（prod）ではスキップする（`if: github.ref_name == 'develop'`）。devmock の混入や外部サービスとの結合不良を実環境で検出し、失敗時は自動で前バージョンに戻るため、壊れた状態が長時間続かない。

## 背景・課題

単体テストだけでは検出できない問題がある。

- Cloud Run の環境変数設定ミス（`APP_MODE` 未設定で devmock が動く等）
- Firebase Auth ↔ バックエンド間の認証フロー
- PokeAPI / Gemini API の実際のレスポンス形式の変更
- Firestore の権限設定

dev 環境（develop ブランチ）はデプロイ頻度が高く、壊れた状態のまま放置されるリスクがある。

## 詳細

### フロー

```
deploy-backend → integration-test → deploy-frontend
                      ↓ (失敗時)
                  自動ロールバック（前リビジョンにトラフィック切替）
```

### テスト内容

1. **Prod Mode Check**：認証なしリクエスト → 401 であること（devmock なら 200 になる）
2. **New Quest**：実 PokeAPI からポケモンデータ取得
3. **Score Translation**：実 Gemini API でスコアリング
4. **Capture Pokemon**：捕獲フロー完走
5. **Get Collection**：コレクション取得

### テストユーザー管理

- テスト前：Firebase Auth REST API でテストユーザー作成 + Firestore `allowed_emails` に追加
- テスト後（always）：Firestore テストデータ削除 + `allowed_emails` からテストメール除去 + Firebase Auth ユーザー削除

### ロールバック

```bash
PREV=$(gcloud run revisions list --service $SERVICE --sort-by ~creationTimestamp --limit 2 | tail -1)
gcloud run services update-traffic $SERVICE --to-revisions $PREV=100
```
