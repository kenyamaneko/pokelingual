import api from "./client";
import type { SettingsResponse } from "../../../shared/api-types/settings";

/** ユーザ設定エンドポイントを呼ぶ API クライアント。 */
export const settingsApi = {
  getSettings: () => api.get<SettingsResponse>("/settings"),
  updateExcludedPokemon: (pokemonIDs: number[]) =>
    api.put("/settings/excluded-pokemon", { pokemon_ids: pokemonIDs }),
};
