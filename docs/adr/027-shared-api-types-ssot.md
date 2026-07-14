# ADR-027: API 契約型を shared/api-types 配下の SSOT に統一する

## ステータス

Accepted

## 結論

backend と frontend の API リクエスト・レスポンス型（wire format）を `shared/api-types/*.d.ts` に集約し、両方が `import type` で参照する。frontend 側に契約型の再定義は持たない。

## 背景・課題

backend の Handler 層と frontend の API クライアント層は別々のコードベースであり、双方が個別にリクエスト・レスポンス型を定義すると、片方だけ変更されたときに型が乖離する。`import type` は型情報のみを取り込みコンパイル時に消去されるため、実行時に読み込む共有パッケージを作らずに契約型だけを一箇所に持てる。

## 詳細

- 契約型ファイルは `shared/api-types/*.d.ts` に置く（例：`error.d.ts` で 4xx/5xx 共通エラーボディ `{ error: string }` を宣言し、backend の送出箇所に `satisfies` で適用する）。
- backend / frontend はいずれも `import type` でのみ参照し、値としてのモジュールはimportしない。
