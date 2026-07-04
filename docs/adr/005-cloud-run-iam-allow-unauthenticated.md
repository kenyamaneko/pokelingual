# ADR-005: Cloud Run の IAM を allUsers（無認証許可）に設定

## ステータス

採用済み

## コンテキスト

Cloud Run はデフォルトで IAM ベースの認証を要求する。
リクエストに Google Cloud IAM トークン（サービスアカウントキーや Workload Identity トークン）がないと 401 を返す。

PokeLingual のフロントエンドは Firebase Auth を使い、リクエストに Firebase ID トークンを付与する。
しかし、Firebase ID トークンは Google Cloud IAM トークンではないため、Cloud Run の IAM レイヤーで拒否される。

## 決定

Cloud Run に `--allow-unauthenticated` を設定し、IAM レベルの認証を無効化する。
アプリレベルの認証は `middleware/auth.go` の Firebase Auth ミドルウェアが担保する。

これは Google が推奨するエンドユーザー向け API のパターン:
- IAM 認証 = サービス間通信向け（バックエンド同士）
- Firebase Auth = エンドユーザー向け（ブラウザ/アプリ）

## 結果

- フロントエンドから Firebase ID トークンで直接 Cloud Run にアクセス可能
- アクセス制御はアプリ側の Firebase Auth ミドルウェア + ホワイトリストで実現
- Cloud Run の IAM ポリシーに `allUsers: roles/run.invoker` が必要
  - Terraform 管理外（deploy.yml の `--allow-unauthenticated` が自動設定）
  - deploy SA に `roles/run.admin` が必要（`run.services.setIamPolicy` 権限のため）
