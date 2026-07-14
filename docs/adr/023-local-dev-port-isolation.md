# ADR-023: ローカル開発ポートを 151xx 帯に隔離する

## ステータス

Accepted

## 結論

ローカル開発で使うポートを pokelingual 専用の 151xx 帯に統一し、汎用ポート（8080 / 5173）をホストのポート空間から排除する。ホストへの bind が避けられない経路は loopback（`127.0.0.1`）かつ 151xx 帯に束ねる。これにより、ローカルの全経路（compose / 素の `npm run dev` / テスト）で他アプリとのポート衝突が構造的に起きなくなる。Cloud Run の本番挙動には影響しない。

## 背景・課題

ローカルデバッグ時に他アプリとポートが衝突する事象が繰り返し起きていた。Firestore Emulator（ホスト直起動）の 8080 は他アプリと衝突し、素の `npm run dev` もバックエンド 8080・フロントエンド 5173 の汎用ポートで被りやすい。番号を都度ずらす対症療法では空きポート探しが恒常化するため、専用の帯に寄せて取り合い自体を無くす。

## 詳細

| 用途 | 変更前 | 変更後 |
|---|---|---|
| backend（compose） | 15100 | 15100（変更なし） |
| backend（素の `npm run dev` 既定） | 8080 | **15100** |
| frontend（compose） | 15151 | 15151（変更なし） |
| frontend（素の `npm run dev` = Vite 既定） | 5173 | **15151** |
| Firestore Emulator（`firebase.json`、ホスト直） | 8080 | **15180** |
| Firestore Emulator（compose 内部） | 8080 | **15180**（一貫性のため） |

- `firebase.json` の Emulator は `host: 127.0.0.1` + `port: 15180`。テストは `firebase emulators:exec` が Emulator とテストプロセスをホスト上で loopback 接続させる形態のためホスト bind 自体は残し、loopback + 非既定ポートで衝突面を消す。
- compose の Emulator は従来どおりホストへ publish しない。
- Vite は `strictPort: true` とし、15151 が塞がっていれば別ポートへ逃げず起動を失敗させる（デフォルト値へのフォールバック禁止と同じ思想）。
- Firestore クライアントは `FIRESTORE_EMULATOR_HOST`、backend は `PORT` env を優先するため、アプリコードの変更は不要。
- Cloud Run が注入する `PORT`（既定 8080）は Google 側の仕様であり対象外（`docs/ops/troubleshooting.md` の 8080 記述も Cloud Run 仕様の説明なので変更しない）。Emulator Hub（4400）等、Firestore 以外の補助ポートもスコープ外とする。

## 不採用案

- **衝突のたびに一時設定で空きポートへ逃がす**：実際に 8081 へ逃がして別のアプリとの衝突を踏んだ。
- **テスト用 Emulator も compose ネットワークに載せてホスト bind を無くす**：`firebase emulators:exec` ベースのテストランナーの作り替えが必要で、本 ADR のスコープ外（将来課題）。
- **ポートを env でパラメータ化する**：`firebase.json` は静的 JSON で複数 config かラッパが要る。固定の非既定ポートで衝突は十分に消える。
