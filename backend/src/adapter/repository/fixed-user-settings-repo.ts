import type { UserSettingsRepository } from "../../domain/ports.js";
import type { UserSettings } from "../../domain/user.js";

/** ユーザー設定に依存せず、常に既定設定 (除外なし・全世代) を返す UserSettingsRepository 実装。 */
export class FixedUserSettingsRepo implements UserSettingsRepository {
  /**
   * @returns 除外なし・全世代の既定設定。
   */
  async getSettings(): Promise<UserSettings> {
    return { excluded_pokemon_ids: null, enabled_generations: null };
  }

  /**
   * @throws 書き込みは未対応。
   */
  async updateExcludedPokemon(): Promise<void> {
    throw new Error("FixedUserSettingsRepo does not support writes");
  }

  /**
   * @throws 書き込みは未対応。
   */
  async updateEnabledGenerations(): Promise<void> {
    throw new Error("FixedUserSettingsRepo does not support writes");
  }
}
