# ADR-012: メール/パスワード認証 + ホワイトリスト

## ステータス

Superseded by [ADR-022](022-google-signin-and-public-mode.md)（メール/パスワード認証は併存維持）

## 結論

Gemini API のコストを抑えるためアクセスを制限する。以下を採用し、意図しないユーザーのアクセスを防ぐ。ホワイトリストは Firestore 上にあり、再デプロイなしに変更できる。

1. **認証方式**：Firebase Authentication のメール/パスワード認証のみ
2. **サインアップ UI なし**：アカウントは Firebase Console で手動作成
3. **ホワイトリスト**：Firestore `config/auth` ドキュメントの `allowed_emails` 配列で管理
4. サーバー起動時に `allowed_emails` を読み込み、存在しなければ `log.Fatalf` で起動拒否

## 背景・課題

個人プロジェクトであり、不特定多数にサービスを公開する予定はない。Google ログインは手軽だが、誰でもアカウントを作成できてしまう。Gemini API にはコストが発生する。
