# ADR-004: PokeAPI の説明文を Gen 6 以降から取得

## ステータス

採用済み

## コンテキスト

PokeLingual の核心は「英語の図鑑説明文を日本語に翻訳する」こと。
EN/JA の説明文ペアが必要だが、PokeAPI の `flavor_text_entries` には制約がある。

### 調査結果

- Gen 1-5 のゲーム（赤緑〜BW2）の `flavor_text_entries` には**英語のみ**存在
- 日本語（`ja` / `ja-Hrkt`）が存在するのは **Gen 6（XY）以降**のゲームのみ
- 原因: PokeAPI のデータソース（Veekun）が古い世代の日本語テキストを収録していない

### ポケモン対象範囲

Gen 1-5（ID 1-649）のポケモンを対象とする。
Gen 6+ のゲームにはこれら全ポケモンの図鑑説明が（各ゲームの全国図鑑として）収録されている。

## 決定

- 対象ポケモン: Gen 1-5（MaxPokemonID = 649）
- 説明文ソース: Gen 6+ のゲーム（X, Y, OR, AS, Sun, Moon, US, UM, ピカブイ, Sword, Shield）
- `versionDisplayNames` マップで対象バージョンをフィルタ
- EN/JA ペアをバージョンごとに構築、`ja` 優先で `ja-Hrkt` フォールバック

## 結果

- 1ポケモンあたり最大12種類の EN/JA ペア（重複排除あり）
- 全 Gen 1-5 ポケモンで EN/JA ペアが取得可能
- コレクション画面で複数バージョンの説明文を比較できる
