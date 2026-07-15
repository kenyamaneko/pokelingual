# ADR-026: backend は常に直近の frontend と後方互換を保つ

## ステータス

Accepted

## 結論

backend は常に直近の frontend と**後方互換**を保つ。契約を壊す変更は、backend が新旧両方の契約に対応するリリース → frontend を新しい契約に切り替えるリリース → backend から旧い契約への対応を外すリリース、の複数リリースに分けて出す。

## 背景・課題

backend と frontend は独立して順にデプロイする (backend → frontend)。そのため一時的に backend だけ新しいバージョンに進み、frontend が旧いバージョンのまま取り残される状態が起こる。この状態でも frontend に不具合が起きないようにする。
