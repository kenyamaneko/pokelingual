# ADR-014: PokeAPI の説明文を Gen 6 以降から取得

## ステータス

Accepted

## 結論

英語と日本語の説明文ペアを確保するため、対象ポケモンを Gen 1-8（MaxPokemonID = 898）に定め、説明文は日本語が存在する Gen 6 以降のゲームから取得する。全対象ポケモンで EN/JA ペアが得られ、コレクション画面で複数バージョンを比較でき、MaxPokemonID の更新だけで対象範囲を拡張できる。

- 対象ポケモン：Gen 1-8（MaxPokemonID = 898、Firestore `config/app` で管理）
- 説明文ソース：Gen 6+ のゲーム（X, Y, OR, AS, Sun, Moon, US, UM, ピカブイ, Sword, Shield）
- `versionDisplayNames` マップで対象バージョンをフィルタし、EN/JA ペアをバージョンごとに構築（`ja` 優先で `ja-Hrkt` フォールバック）

## 背景・課題

PokeLingual の核心は英語の図鑑説明文を日本語に翻訳することで、EN/JA の説明文ペアが必要になる。PokeAPI の `flavor_text_entries` には制約がある。

- Gen 1-5 のゲーム（赤緑〜BW2）には**英語のみ**存在する
- 日本語（`ja` / `ja-Hrkt`）が存在するのは **Gen 6（XY）以降**のゲームのみ
- 原因は、PokeAPI のデータソース（Veekun）が古い世代の日本語テキストを収録していないこと

## 詳細

対象範囲は Gen 1-8（ID 1-898）で、制約は以下のとおり。

- **Gen 6-7（#650-809）**：全ポケモンで EN/JA ペア取得可能
- **Gen 8（#810-898）**：Sword/Shield の通常ポケモンは全て取得可能
- **#899-905（Legends: Arceus）**：PokeAPI の対象バージョン（X〜Shield）に説明文が存在しないため除外
- **Gen 9（#906+）**：PokeAPI にデータなし（Scarlet/Violet 未収録）

MaxPokemonID はハードコードせず Firestore config から読み込む。1 ポケモンあたり最大 12 種類の EN/JA ペアを持ち、重複は排除する。
