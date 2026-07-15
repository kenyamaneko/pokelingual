import type { FlavorTextPair } from "../../../shared/api-types/pokedex.js";
import type { PokemonType } from "../../../shared/api-types/pokemon.js";

/** ポケモンの種別情報を内部表現に変換した型。 */
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

/** データソースが保持するポケモン種別情報。sprite_url は保持せず、図鑑番号から読み出し時に組み立てる。 */
export type PokemonRecord = Omit<Pokemon, "sprite_url">;
