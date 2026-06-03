/**
 * Pokelingual のユーザ設定 API 契約型。両側で import type する SSOT。
 */

/** GET /api/settings のレスポンス。 */
export interface SettingsResponse {
  excluded_pokemon_ids: number[];
  max_pokemon_id: number;
  max_excluded_count: number;
}

/** PUT /api/settings/excluded-pokemon のリクエストボディ。 */
export interface UpdateExcludedPokemonRequest {
  pokemon_ids: number[];
}
