# ADR-036: dev 環境の Firebase Auth で新規ユーザー登録を無効化する

## ステータス

Accepted

## 結論

`google_identity_platform_config` の `client.permissions.disabled_user_signup` を使い、dev の Firebase Auth で新規アカウント作成を無効化する。既存ユーザーのサインインには影響しない。開発者アカウントは今後も管理者が手動作成する運用とする。prod はこの設定を無効のままにする。

## 背景・課題

dev 環境は Cloud Run (`--allow-unauthenticated`)・Firebase Hosting ともに公開されており、Firebase Auth の新規サインアップも誰でも行える状態だった。以前あった `config/auth.allowed_emails` によるメールアドレス許可リストは、prod を一般公開する方針に合わせて廃止済みで、この認証ミドルウェアは dev/prod 共通のため dev も同様に公開されたままになっていた。

dev は開発者だけが使う想定であり、非開発者によるアクセスを塞ぎたい。開発者アカウントは今後も管理者が手動作成する運用でよいことを確認済みで、新規に自己登録させる必要はない。

## 不採用案

- **IAP (Identity-Aware Proxy) をロードバランサー経由で導入する**：Google Cloud ネイティブでアクセス制御・監査ができるが、Cloud Run の前段にロードバランサーを常設する必要があり固定費が増える。dev はコストを抑えたい環境のため見送った。
- **Basic 認証を前段に挟む**：手軽だが共有パスワードになり利用者個人を識別できない。Firebase Hosting 自体にはアクセス制御機能がなく、別途 CDN 層やミドルウェアを挟む構成が追加で必要になる。
- **Firebase Auth Blocking Functions + メール許可リストで自己登録を絞る**：新規開発者が自己登録できる利点はあるが、専用の Cloud Function・Secret Manager・デプロイパイプラインが必要になり、開発者アカウントを管理者が手動作成する運用で足りる今回の要件には過剰。加えて Blocking Functions の登録を Terraform と Firebase CLI のどちらが持つかで設定が競合するリスクもある。
