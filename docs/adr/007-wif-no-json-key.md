# ADR-007: Workload Identity Federation（WIF）による JSON キーレス認証

## ステータス

採用済み

## コンテキスト

GitHub Actions から Google Cloud にデプロイするには認証が必要。
従来の方法はサービスアカウントの JSON キーを GitHub Secrets に保存する方式だが、以下のリスクがある:
- キーの漏洩リスク（永続的なクレデンシャル）
- キーのローテーション管理が必要

## 決定

Workload Identity Federation（WIF）を使い、GitHub Actions の OIDC トークンで直接 Google Cloud に認証する。

### 構成

```
GitHub Actions (OIDC トークン)
    ↓
WIF Pool (github-actions)
    ↓
WIF Provider (github-oidc)
    attribute_condition: assertion.repository == "kenyamaneko/Pokelingual"
    ↓
Service Account (github-actions-deploy)
    roles: artifactregistry.writer, run.admin, datastore.user, firebasehosting.admin
```

## 結果

- JSON キー不要。短命トークンのみ使用
- リポジトリレベルでアクセスを制限（他リポジトリからは認証不可）
- Terraform で WIF Pool / Provider / SA を一括管理
- GitHub Actions 側は `google-github-actions/auth@v2` で WIF 認証
