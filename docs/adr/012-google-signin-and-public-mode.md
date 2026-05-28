# ADR-012: Google Sign-In 追加 + ホワイトリストの公開モード対応

## ステータス

採用済み（ADR-002 を上書き）

## コンテキスト

[ADR-002](002-email-password-auth.md) では「個人プロジェクトで不特定多数に公開しない」前提で、
メール/パスワード + ホワイトリスト方式を採用した。

その後の方針変更として、**転職用ポートフォリオとして SNS で広く公開する**ことを決定。
非エンジニアが触りに来ても登録ハードルが低い状態にする必要が出てきた。

論点:

1. ホワイトリストを完全撤廃するか、フラグ化するか
2. メール/パスワード認証を残すか、Google のみに絞るか
3. Anonymous Auth を許可するか

## 決定

### 1. ホワイトリストは「空配列で公開モード」として残す

- `auth.ts` のホワイトリスト検証ロジックは未変更
- `main.ts` の「空配列で起動拒否」だけ緩和（警告ログのみ）
- dev 環境: `config/auth.allowed_emails = ["test@pokelingual.dev", "owner@example.com"]`
- prod 環境: `config/auth.allowed_emails = []`（= 公開モード）

これにより:
- dev は引き続き保護されたまま（結合テストで使う仕組みも維持）
- prod だけ公開できる
- 不正アクセスが発覚したら prod の Firestore でホワイトリスト復活も可能

### 2. Google Sign-In を追加、メール/パスワードも併存

UI 上は **Google を主、メールを従** とする:
- 「Google で　はじめる」ボタンを大きく上に
- 「または」区切り線
- メール/パスワードフォームを小さめに下に

メール/パスワードを残す理由:
- 結合テスト（`TEST_USER_EMAIL` でカスタムトークン取得）が無修正で動作するため
- Google サインインで何か問題が出た場合のフォールバック

Terraform 側では `google_identity_platform_default_supported_idp_config` で google.com IDP を有効化。
OAuth クライアントは GCP コンソールで手動作成し、Terraform 変数で client_id/secret を注入する設計。
（OAuth クライアント自体は Terraform で作成不可）

### 3. Anonymous Auth は不採用

濫用防止が困難なため:
- Anonymous で無限にアカウント作成 → per-user 30回/日の上限を簡単に突破できる
- IP 単位のレートリミットは Cloud Run + Firebase Hosting 構成では実装が重い
- Google サインインを必須にすればこのリスクは消える

## 結果

- 一般ユーザーは Google アカウントだけでログイン可能（登録ハードル最小）
- per-user レートリミット（30回/日）が抜け道なしに効く
- dev 環境の保護とテスト互換性を維持
- prod から dev への意図しないアクセスを防止（Firestore のホワイトリストで分離）
