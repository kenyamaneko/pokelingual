import type { FlavorTextPair } from "../../../shared/api-types/collection.js";
import type { PokemonType } from "../../../shared/api-types/pokemon.js";
export type { PokemonType };

/** PokemonType の全 18 種 (実行時検証用)。shared の PokemonType と一致させる。 */
const POKEMON_TYPES = [
  "normal", "fire", "water", "electric", "grass", "ice",
  "fighting", "poison", "ground", "flying", "psychic", "bug",
  "rock", "ghost", "dragon", "dark", "steel", "fairy",
] as const satisfies readonly PokemonType[];

const POKEMON_TYPE_SET: ReadonlySet<string> = new Set(POKEMON_TYPES);

/**
 * PokeAPI 由来のタイプ名を PokemonType に検証付きで変換する。
 * @param name PokeAPI の types[].type.name
 * @returns 既知の PokemonType
 */
export function toPokemonType(name: string): PokemonType {
  if (!POKEMON_TYPE_SET.has(name)) {
    // 対象は Gen 1-8 の 18 種で固定。未知が来たら「意図しない値」として境界で失敗させる
    throw new Error(`unknown pokemon type from PokeAPI: ${name}`);
  }
  return name as PokemonType;
}

/** PokeAPI から取得したポケモン情報を内部表現に変換した型。 */
export interface Pokemon {
  id: number;
  name_en: string;
  name_ja: string;
  description_en: string;
  description_ja: string;
  sprite_url: string;
  base_stat_total: number;
  types: PokemonType[];
  height: number;
  weight: number;
  is_legendary: boolean;
  is_mythical: boolean;
  flavor_texts?: FlavorTextPair[];
}
