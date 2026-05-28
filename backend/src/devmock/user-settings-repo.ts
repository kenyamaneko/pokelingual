import type { UserSettingsRepository } from "../domain/interfaces.js";
import type { UserSettings } from "../types/index.js";

/** ローカル開発用のインメモリ UserSettingsRepository 実装。 */
export class MockUserSettingsRepo implements UserSettingsRepository {
  private settings = new Map<string, UserSettings>();

  async getSettings(uid: string): Promise<UserSettings> {
    return this.settings.get(uid) ?? { excluded_pokemon_ids: null };
  }

  async updateExcludedPokemon(uid: string, pokemonIDs: number[]): Promise<void> {
    this.settings.set(uid, { excluded_pokemon_ids: pokemonIDs });
  }
}
