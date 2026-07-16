import type { UserPokemonRepository } from "../../domain/ports.js";
import type { UserPokemon } from "../../domain/user.js";

/** 捕獲を図鑑・実績に記録しないための UserPokemonRepository 実装。 */
export class NoopUserPokemonRepo implements UserPokemonRepository {
  /**
   * 遭遇・捕獲を永続化しない。
   */
  async upsertEncounter(): Promise<void> {}

  /**
   * @throws 読み取りは未対応。
   */
  async getPokedex(): Promise<UserPokemon[]> {
    throw new Error("NoopUserPokemonRepo does not support reads");
  }

  /**
   * @throws 読み取りは未対応。
   */
  async getPokemon(): Promise<UserPokemon> {
    throw new Error("NoopUserPokemonRepo does not support reads");
  }
}
