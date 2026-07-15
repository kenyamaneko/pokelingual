# ADR-009: 認証に Firebase Auth を採用する

## ステータス

Accepted

## 結論

ユーザー認証は Firebase Auth に統一する。

## 背景・課題

開発者が慣れていて手軽なことに加え、Cloud Run・Firestore など他の Google Cloud サービスとの相性がいい。
