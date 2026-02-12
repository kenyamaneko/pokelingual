# ADR-002: メール/パスワード認証 + ホワイトリスト

## ステータス

採用済み

## コンテキスト

個人プロジェクトであり、不特定多数にサービスを公開する予定はない。
Google ログインは手軽だが、誰でもアカウントを作成できてしまう。
Gemini API にはコストが発生するため、アクセスを制限したい。

## 決定

1. **認証方式**: Firebase Authentication のメール/パスワード認証のみ
2. **サインアップ UI なし**: アカウントは Firebase Console で手動作成
3. **ホワイトリスト**: Firestore `config/auth` ドキュメントの `allowed_emails` 配列で管理
4. サーバー起動時に `allowed_emails` を読み込み、存在しなければ `log.Fatalf` で起動拒否

## 結果

- 意図しないユーザーのアクセスを防止
- ホワイトリストは Firestore で管理されるため、再デプロイなしに変更可能
- サインアップ UI がないため、ユーザー追加は手動（Firebase Console + Firestore）
