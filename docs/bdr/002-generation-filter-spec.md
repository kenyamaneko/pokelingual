# BDR-002: 出題世代フィルタの仕様

## ステータス

Accepted

## 結論

出題されるポケモンを世代（第 1〜8 世代）で絞り込む per-user 設定を提供する。`users/{uid}/settings/preferences.enabled_generations`（Firestore）に保持し、設定画面のチェックボックスで選ぶ。未設定なら全世代。最低 1 世代の選択を必須とする（全解除は不可）。

- **出題プールにのみ適用**：`newQuest` の抽選対象を選択世代の図鑑番号に限定する。
- **図鑑の母数は変えない**：`getCollection` には適用しない。フィルタは出題対象を絞るだけで、捕獲済み数など通算実績の表示には影響しない。

## 背景・課題

出題プールが空になると抽選できずエラーになる（`EmptyQuestPoolError`）。空プールを構造的に防ぐため、世代フィルタは最低 1 世代の選択を必須にする（全解除不可）。

## 詳細

世代境界は `domain/generation.ts` の `GENERATION_RANGES`（全国図鑑の世代区分）を SSoT とする。
