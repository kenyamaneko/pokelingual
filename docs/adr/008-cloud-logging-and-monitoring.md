# ADR-008: 監視に Cloud Logging / Cloud Monitoring を採用する

## ステータス

Accepted

## 結論

ログ・監視基盤は Cloud Logging / Cloud Monitoring に統一する。

## 背景・課題

実行基盤は Cloud Run・Firestore という Google Cloud ネイティブなサービスに閉じている。個人開発でコストも抑えたい。

## 不採用案

- **Datadog**：機能面では優位だが、コストに見合う恩恵が Cloud Run + Firestore 中心の構成では小さい。
