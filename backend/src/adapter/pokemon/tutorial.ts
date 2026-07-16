import type { PokemonClient } from "../../domain/ports.js";
import type { Pokemon, PokemonRecord } from "../../domain/pokemon.js";
import type { PokemonType } from "../../../../shared/api-types/pokemon.js";
import { buildSpriteURL } from "./sprite-url.js";

// 説明文は案内する訳文「電気タイプのねずみポケモン」に対応させた単純文にする。
const TUTORIAL_PIKACHU: PokemonRecord = {
  id: 25,
  name_en: "Pikachu",
  name_ja: "ピカチュウ",
  description_en: "It is an Electric-type Mouse Pokémon.",
  description_ja: "電気タイプのねずみポケモン",
  base_stat_total: 320,
  types: ["electric"],
  height: 4,
  weight: 60,
  is_legendary: false,
  is_mythical: false,
};

/** 出題を常にピカチュウ固定で供給する PokemonClient 実装。 */
export class TutorialPokemonClient implements PokemonClient {
  /**
   * @returns ピカチュウの図鑑番号のみ。
   */
  getServableIDs(): readonly number[] {
    return [TUTORIAL_PIKACHU.id];
  }

  /**
   * @param id ポケモン ID。
   * @returns ピカチュウ。
   * @throws ピカチュウ以外を要求された場合。
   */
  async getPokemonByID(id: number): Promise<Pokemon> {
    if (id !== TUTORIAL_PIKACHU.id) {
      throw new Error(`tutorial pokemon client serves only pikachu, got: ${id}`);
    }
    return { ...TUTORIAL_PIKACHU, sprite_url: buildSpriteURL(TUTORIAL_PIKACHU.id) };
  }

  /**
   * @param type ポケモンのタイプ。
   * @returns でんきタイプに合致する図鑑番号。
   */
  async getIDsByType(type: PokemonType): Promise<readonly number[]> {
    return TUTORIAL_PIKACHU.types.includes(type) ? [TUTORIAL_PIKACHU.id] : [];
  }
}
