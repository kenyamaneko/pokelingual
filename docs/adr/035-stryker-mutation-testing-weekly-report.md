# ADR-035: StrykerJS によるミューテーションテストを週次レポート運用で導入する

## ステータス

Accepted

## 結論

StrykerJS (`@stryker-mutator/core` + `@stryker-mutator/vitest-runner`) を backend に導入する。対象は純粋ロジックの `domain/generation.ts` / `domain/exclusion.ts` / `domain/legendary.ts` / `service/quest-service.ts` の4ファイルに固定する。週次 schedule (月曜05:00 JST) と `workflow_dispatch`、および mutation 設定ファイル自体を変更する PR での動作検証に限定した `pull_request` トリガーで実行し、`thresholds.break` は設定しない report-only 運用とする。`calculateCaptureRate` のフィッティング済みロジット係数の式は disable コメントで除外するが、ボール補正 (`ballBonus`) の加算は既存テストで殺せる変異なので式を2行に分け、除外範囲から外して退行検知を残す。

## 背景・課題

行カバレッジはテストの実行有無しか測れず、アサーションが振る舞いを実際に検証しているかは測れない。境界値網羅までテスト規約で要求している出題プール構築・捕獲率などゲームロジック中核の退行検知力を、ミューテーションテストで監査する。

対象を純粋ロジックの4ファイルに絞ったのは、生き残る変異が「境界の片側しか検証していない」といった本物のテスト欠陥を指す確度が高いため。Firestore Emulator 依存のリポジトリ層は対象外とする (シリアル実行を巻き込むと実行が重くなる)。frontend も対象外とする (UI の変異は信号が低くノイズが多い)。

CI のゲートにはしない。PR ごとに回すと実行時間が PR サイクルに乗り、baseline 未確立のまま break 値を決められず、equivalent mutant (同値変異) による fail がノイズ化する。まず週次レポートで baseline を作り、gate 化は別途判断する。

## 不採用案

- **incremental / `--since` による差分実行**: 対象が固定4ファイルで full run が短い (ローカル実測で約12秒)。`reports/stryker-incremental.json` の cache 配管と stale 結果リスクに見合わない。実行時間が肥大化したら再検討する。
- **`@stryker-mutator/typescript-checker` の導入**: 対象は strict TypeScript の純粋関数で、主要な変異 (算術・条件・等価演算子) はほぼ型的に valid。checker はミュータント毎に tsc program を走らせて遅くなる。型起因ノイズが目立てば後追いで導入を検討する。
- **`calculateCaptureRate` 全体の除外**: 関数全体は除外しない。正規化 (`/ 100.0`) やロジスティック変換、ボール補正の加算は既存テストの単調性・順序検証で殺せる変異であり、退行検知として残す価値がある。除外はフィッティング済み係数の式1行のみに限定する。
