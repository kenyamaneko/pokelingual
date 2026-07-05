/**
 * Pokelingual のユーザ設定 API 契約型。両側で import type する SSOT。
 */

/** GET /api/settings のレスポンス。ユーザ自身の除外ポケモンIDと出題対象の世代。 */
export interface SettingsResponse {
  excluded_pokemon_ids: number[];
  /** 出題対象の世代。未設定ユーザーは全世代が返る。 */
  enabled_generations: number[];
}

/** PUT /api/settings/excluded-pokemon のリクエストボディ。 */
export interface UpdateExcludedPokemonRequest {
  pokemon_ids: number[];
}

/** PUT /api/settings/generations のリクエストボディ。出題対象の世代 (最低1世代)。 */
export interface UpdateEnabledGenerationsRequest {
  generations: number[];
}
