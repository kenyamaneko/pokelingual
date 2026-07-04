/**
 * Pokelingual のポケモンタイプ契約型。両側で import type する SSOT。
 */

/**
 * ポケモンのタイプ名。第6世代以降の 18 種で固定。
 * PokeAPI の `types[].type.name` に一致する (小文字英語)。
 */
export type PokemonType =
  | "normal"
  | "fire"
  | "water"
  | "electric"
  | "grass"
  | "ice"
  | "fighting"
  | "poison"
  | "ground"
  | "flying"
  | "psychic"
  | "bug"
  | "rock"
  | "ghost"
  | "dragon"
  | "dark"
  | "steel"
  | "fairy";
