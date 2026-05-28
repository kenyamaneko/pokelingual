import api from "./api";

/** /settings エンドポイントのレスポンス形。 */
export interface UserSettings {
  excluded_pokemon_ids: number[];
  max_pokemon_id: number;
}

/** ユーザ設定エンドポイントを呼ぶ API クライアント。 */
export const settingsApi = {
  getSettings: () => api.get<UserSettings>("/settings"),
  updateExcludedPokemon: (pokemonIDs: number[]) =>
    api.put("/settings/excluded-pokemon", { pokemon_ids: pokemonIDs }),
};
