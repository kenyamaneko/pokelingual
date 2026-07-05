# ADR-013: ローカル開発ポートを 151xx 帯に隔離する

## ステータス

Accepted

## 結論

ローカル開発で他プロジェクトとポートが衝突するのを構造的に無くすため、ローカル開発で使うポートを 151xx 帯に統一し、ホストのポート空間から汎用ポート（8080 / 5173）を排除する。ホスト bind が避けられない経路は loopback（`127.0.0.1`）かつ 151xx 帯の非既定ポートに束ねる。ローカルの全経路（compose / 素の `npm run dev` / `make test-backend`）が 151xx 帯に載り、overload-party の e2e スタック稼働中でも衝突しなくなる。Cloud Run の本番挙動には影響しない。

## 背景・課題

overload-party の ADR-049「ローカル開発インフラをホストに公開せず内部ネットワークで参照する」（別リポ `overload-party-common/docs/adr/049-local-dev-infra-host-port-isolation.md`）の思想を、pokelingual の構成（単一リポ / Firestore Emulator）に合わせて取り入れる。

ローカルデバッグ時に他プロジェクトとポートが衝突する事象が繰り返し起きていた。

- Firestore Emulator（ホスト直起動、`make test-backend` / `make emulator-up`）が **8080** で、overload-party の e2e スタックと衝突する。代替に使った **8081** も別プロジェクト（React Native の Metro）と衝突した。
- 素の `npm run dev` はバックエンドが **8080**（`config.ts` の mock 既定）、フロントエンドが **5173**（Vite 既定）で、いずれも汎用ポートのため被りやすい。

衝突の根本は「有限のホストポート空間を複数プロセスが取り合う」ことにある。pokelingual は単一リポなので overload-party ADR-049 の「リポ間衝突」は該当せず、効くのは**外部アプリとの衝突**（具体的には overload-party 自身の emulator との同時起動衝突）である。docker-compose の dev スタックは既に **151xx 帯**（backend 15100 / frontend 15151）を専有し、Firestore Emulator をホストに publish しない設計を採っており、残る衝突源は「ホストに直接 bind する経路」だけだった。

## 詳細

| 用途 | 変更前 | 変更後 |
|---|---|---|
| backend (compose) | 15100 | 15100 (変更なし) |
| backend (素の `npm run dev` 既定) | 8080 | **15100** |
| frontend (compose) | 15151 | 15151 (変更なし) |
| frontend (素の `npm run dev` = Vite 既定) | 5173 | **15151** |
| Firestore Emulator (`firebase.json`、ホスト直) | 8080 | **15180** |
| Firestore Emulator (compose 内部) | 8080 | **15180** (一貫性のため) |

- `firebase.json` の Firestore Emulator は `host: 127.0.0.1` + `port: 15180`。テスト経路は `firebase emulators:exec` が emulator とテストプロセスをホスト上に同居させ loopback 接続する形態のため、compose の「publish しない + 内部 DNS」は使えず、ADR-049 が fast-loop 用に定めた **loopback + 非既定ポート** の緩和策を採る。
- compose の Emulator は従来どおりホストへ publish せず、内部ポートのみ 15180 へ合わせる。
- Vite は `server.port: 15151` に加え `strictPort: true` とし、15151 が塞がっていれば黙って別ポートに逃げず起動を失敗させる（ポート統一の意図を守る = デフォルト値へのフォールバック禁止と同じ思想）。

汎用ポート（8080 / 5173）を有限のホスト空間から外し、pokelingual 専用の 151xx 帯に寄せることで、他プロジェクトとの取り合いが構造的に起きにくくなる。番号を都度ずらす対症療法と違い、恒常的な番号管理が要らない。Firestore クライアントは `FIRESTORE_EMULATOR_HOST` を読むだけでポート非依存、backend も `PORT` env を優先するのでアプリコードの変更は不要である。

Cloud Run が注入する `PORT`（既定 8080）は Google 側の仕様であり対象外（`config.ts` が `PORT` env を優先するため本番に影響せず、`docs/troubleshooting.md` の 8080 記述も Cloud Run 仕様の説明なので変更しない）。Firestore Emulator Hub の既定ポート（4400）等、Firestore 以外の emulator 補助ポートは本 ADR のスコープ外とする。

## 不採用案

- **8080 のまま衝突時に手動 temp-config で逃がす**：衝突のたびに空きポートを探して一時設定を作る手作業が恒常化する。実際に 8081 へ逃がして別衝突を踏んだ。
- **テスト用 Emulator を compose ネットワークに載せる**：「publish しない + 内部 DNS」の理想形に最も近いが、`firebase emulators:exec` ベースのテストランナーを作り替える必要があり本 ADR のスコープ外（将来課題）。
- **ポートを env でパラメータ化する**：`firebase.json` は静的 JSON で、複数 config かラッパが要る。単一リポ・単一 Emulator では過剰で、固定の非既定ポートで衝突は十分に消える。
