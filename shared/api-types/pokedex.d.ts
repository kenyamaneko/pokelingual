/**
 * Pokelingual の図鑑コレクション関連 API 契約型。両側で import type する SSOT。
 */
import type { PokemonType } from "./pokemon.js";

/** 図鑑説明文の英日ペア。複数バージョンを 1 件にまとめる。 */
export interface FlavorTextPair {
  version_names: string[];
  description_en: string;
  description_ja: string;
}

/** 図鑑一覧の 1 エントリ。 */
export interface PokedexEntry {
  pokemon_id: number;
  name_en: string;
  name_ja: string;
  sprite_url: string;
  status: string;
  total_captures: number;
  best_score: number;
}

/** GET /api/pokedex のレスポンス。 */
export interface PokedexResponse {
  pokemon: PokedexEntry[];
  captured_count: number;
  unavailable_count: number;
}

/**
 * GET /api/pokedex/:id のレスポンス。
 * タイムスタンプは ISO 8601 文字列で表現する (HTTP の wire 形式に合わせる)。
 */
export interface PokemonDetailResponse {
  pokemon_id: number;
  status: string;
  total_captures: number;
  total_encounters: number;
  last_captured_at: string | null;
  last_encountered_at: string;
  best_score: number;
  name_en: string;
  name_ja: string;
  description_en: string;
  description_ja: string;
  sprite_url: string;
  types: PokemonType[];
  height: number;
  weight: number;
  flavor_texts?: FlavorTextPair[];
}
