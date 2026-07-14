# ADR-017: Workload Identity Federation（WIF）による JSON キーレス認証

## ステータス

Accepted

## 結論

永続クレデンシャルの漏洩リスクとローテーション負担をなくすため、Workload Identity Federation（WIF）で GitHub Actions の OIDC トークンから直接 Google Cloud に認証する。JSON キーを使わず短命トークンのみを用い、リポジトリレベルでアクセスを制限できる。

## 背景・課題

GitHub Actions から Google Cloud にデプロイするには認証が必要になる。従来はサービスアカウントの JSON キーを GitHub Secrets に保存する方式だが、永続的なクレデンシャルの漏洩リスクと、キーのローテーション管理の負担がある。

## 詳細

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

WIF Pool / Provider / SA は Terraform で一括管理する。GitHub Actions 側は `google-github-actions/auth@v2` で WIF 認証する。
