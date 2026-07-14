# ADR-008: 監視に Cloud Logging / Cloud Monitoring を採用する

## ステータス

Accepted

## 結論

ログ・監視基盤は Cloud Logging / Cloud Monitoring に統一する。

## 背景・課題

Datadog を検討したが、コストがかかりすぎる。また実行基盤が Cloud Run・Firestore という Google Cloud ネイティブなサービスに閉じているため、外部の統合監視サービスを導入しても受けられる恩恵が少なかった。

## 不採用案

- **Datadog**：機能面では優位だが、コストに見合う恩恵が Cloud Run + Firestore 中心の構成では小さい。
