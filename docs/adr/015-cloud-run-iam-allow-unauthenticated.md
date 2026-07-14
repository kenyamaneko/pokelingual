# ADR-015: Cloud Run の IAM を allUsers（無認証許可）に設定

## ステータス

Accepted

## 結論

Firebase Auth を使うフロントエンドから直接アクセスできるようにするため、Cloud Run に `--allow-unauthenticated` を設定し IAM レベルの認証を無効化する。アプリレベルの認証は `middleware/auth.go` の Firebase Auth ミドルウェアが担保する。ブラウザから Firebase ID トークンで直接 Cloud Run にアクセスでき、アクセス制御はアプリ側の Firebase Auth とホワイトリストで実現する。

## 背景・課題

Cloud Run はデフォルトで IAM ベースの認証を要求し、リクエストに Google Cloud IAM トークン（サービスアカウントキーや Workload Identity トークン）がないと 401 を返す。PokeLingual のフロントエンドは Firebase Auth を使いリクエストに Firebase ID トークンを付与するが、Firebase ID トークンは Google Cloud IAM トークンではないため、Cloud Run の IAM レイヤーで拒否される。

## 詳細

Google が推奨するエンドユーザー向け API のパターンに従う。IAM 認証はサービス間通信向け（バックエンド同士）、Firebase Auth はエンドユーザー向け（ブラウザ/アプリ）という使い分けである。

- Cloud Run の IAM ポリシーに `allUsers: roles/run.invoker` が必要
- このポリシーは Terraform 管理外（deploy.yml の `--allow-unauthenticated` が自動設定）
- deploy SA に `roles/run.admin` が必要（`run.services.setIamPolicy` 権限のため）
