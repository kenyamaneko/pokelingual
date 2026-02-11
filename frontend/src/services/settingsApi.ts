import api from "./api";

export interface UserSettings {
  excluded_pokemon_ids: number[];
}

export const settingsApi = {
  getSettings: () => api.get<UserSettings>("/settings"),
  updateExcludedPokemon: (pokemonIDs: number[]) =>
    api.put("/settings/excluded-pokemon", { pokemon_ids: pokemonIDs }),
};
