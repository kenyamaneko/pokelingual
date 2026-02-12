# ADR-004: PokeAPI の説明文を Gen 6 以降から取得

## ステータス

採用済み（更新: 対象範囲を Gen 8 まで拡張）

## コンテキスト

PokeLingual の核心は「英語の図鑑説明文を日本語に翻訳する」こと。
EN/JA の説明文ペアが必要だが、PokeAPI の `flavor_text_entries` には制約がある。

### 調査結果

- Gen 1-5 のゲーム（赤緑〜BW2）の `flavor_text_entries` には**英語のみ**存在
- 日本語（`ja` / `ja-Hrkt`）が存在するのは **Gen 6（XY）以降**のゲームのみ
- 原因: PokeAPI のデータソース（Veekun）が古い世代の日本語テキストを収録していない

### ポケモン対象範囲

Gen 1-8（ID 1-898）のポケモンを対象とする。ただし以下の制約あり:

- **Gen 6-7（#650-809）**: 全ポケモンで EN/JA ペア取得可能
- **Gen 8（#810-898）**: Sword/Shield の通常ポケモンは全て取得可能
- **#899-905（Legends: Arceus）**: PokeAPI の対象バージョン（X〜Shield）に説明文が存在しないため**除外**
- **Gen 9（#906+）**: PokeAPI にデータなし（Scarlet/Violet 未収録）

MaxPokemonID = 898 とし、Legends: Arceus のポケモン（#899-905）は範囲外とする。

## 決定

- 対象ポケモン: Gen 1-8（MaxPokemonID = 898、Firestore `config/app` で管理）
- 説明文ソース: Gen 6+ のゲーム（X, Y, OR, AS, Sun, Moon, US, UM, ピカブイ, Sword, Shield）
- `versionDisplayNames` マップで対象バージョンをフィルタ
- EN/JA ペアをバージョンごとに構築、`ja` 優先で `ja-Hrkt` フォールバック
- MaxPokemonID はハードコードではなく Firestore config から読み込み（将来の拡張に備える）

## 結果

- 1ポケモンあたり最大12種類の EN/JA ペア（重複排除あり）
- Gen 1-8 の全対象ポケモンで EN/JA ペアが取得可能
- コレクション画面で複数バージョンの説明文を比較できる
- PokeAPI のデータ追加に応じて MaxPokemonID を Firestore で更新するだけで対象範囲を拡張可能
