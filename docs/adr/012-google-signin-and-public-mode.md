# ADR-012: Google Sign-In 追加 + ホワイトリストの公開モード対応

## ステータス

Accepted

## 結論

転職用ポートフォリオとして広く公開するため、ホワイトリストを「空配列で公開モード」として残しつつ Google Sign-In を追加する（メール/パスワードも併存）。一般ユーザーは Google アカウントだけで登録ハードルなくログインでき、per-user レートリミットが抜け道なく効き、dev 環境の保護とテスト互換性も維持される。

## 背景・課題

[ADR-002](002-email-password-auth.md) では「個人プロジェクトで不特定多数に公開しない」前提で、メール/パスワード + ホワイトリスト方式を採用した。その後、転職用ポートフォリオとして SNS で広く公開する方針に変更し、非エンジニアが触りに来ても登録ハードルが低い状態にする必要が出てきた。論点は次の 3 つ。

1. ホワイトリストを完全撤廃するか、フラグ化するか
2. メール/パスワード認証を残すか、Google のみに絞るか
3. Anonymous Auth を許可するか

## 詳細

### ホワイトリストは「空配列で公開モード」として残す

- `auth.ts` のホワイトリスト検証ロジックは未変更
- `main.ts` の「空配列で起動拒否」だけ緩和（警告ログのみ）
- dev 環境：`config/auth.allowed_emails = ["test@pokelingual.dev", "owner@example.com"]`
- prod 環境：`config/auth.allowed_emails = []`（= 公開モード）

dev は引き続き保護され（結合テストで使う仕組みも維持）、prod だけ公開できる。不正アクセスが発覚したら prod の Firestore でホワイトリストを復活できる。

### Google Sign-In を追加、メール/パスワードも併存

UI 上は **Google を主、メールを従** とする。「Google で　はじめる」ボタンを大きく上に、「または」区切り線、メール/パスワードフォームを小さめに下に置く。メール/パスワードを残す理由は、結合テスト（`TEST_USER_EMAIL` でカスタムトークン取得）が無修正で動作すること、および Google サインインで問題が出た場合のフォールバックである。OAuth クライアントは Google Cloud コンソールで手動作成する（Terraform で作成不可）。

## 不採用案

- **Anonymous Auth を許可**：Anonymous で無限にアカウントを作成すれば per-user 30 回/日の上限を簡単に突破できる。IP 単位のレートリミットは Cloud Run + Firebase Hosting 構成では実装が重い。Google サインインを必須にすればこのリスクは消える。

## Amendment: 2026-07-02 google.com IdP の有効化を Terraform 管理外へ

google.com IdP の有効化を Terraform 管理外に変更した。当初は `google_identity_platform_default_supported_idp_config` を TF 変数（client_id/secret）で注入していたが、client_secret が tfstate に平文で残り `rules/lang/iac.md`「機密を state に置かない」に反するため、IdP 有効化は Google Cloud コンソール/gcloud で行う運用に切り替えた。

## Amendment: 2026-07-12 ホワイトリスト機構を廃止し公開モードのみにする

ホワイトリスト機構 (`config/auth.allowed_emails` の読み込みと検証) を撤去した。prod を一般公開する方針が確定し、ホワイトリストを維持する前提自体がなくなったため、「空配列で公開モード」という条件分岐ではなく常時公開モードにした。リリース前監査で prod の `allowed_emails` が運用と乖離していた (空配列の想定に対し作成時の 1 件が残留) ことも撤去の後押しになった。dev の保護は Firebase プロジェクトの分離で担保する。
