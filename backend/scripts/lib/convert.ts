import { buildFlavorTextPairs } from "./flavor-text.js";
import type { PokeAPIMoveEntry } from "./moves.js";
import type { PokemonRecord } from "../../src/domain/pokemon.js";
import type { PokemonType } from "../../../shared/api-types/pokemon.js";

/** PokemonType の全 18 種 (PokeAPI 由来の値の検証用)。shared の PokemonType と一致させる。 */
const POKEMON_TYPES = [
  "normal", "fire", "water", "electric", "grass", "ice",
  "fighting", "poison", "ground", "flying", "psychic", "bug",
  "rock", "ghost", "dragon", "dark", "steel", "fairy",
] as const satisfies readonly PokemonType[];

const POKEMON_TYPE_SET: ReadonlySet<string> = new Set(POKEMON_TYPES);

/**
 * PokeAPI 由来のタイプ名を PokemonType に検証付きで変換する。
 * @param name PokeAPI の types[].type.name。
 * @returns 既知の PokemonType。
 * @throws 未知のタイプ名の場合。
 */
function toPokemonType(name: string): PokemonType {
  if (!POKEMON_TYPE_SET.has(name)) {
    // 対象は Gen 1-8 の 18 種で固定。未知が来たら「意図しない値」として境界で失敗させる
    throw new Error(`unknown pokemon type: ${name}`);
  }
  return name as PokemonType;
}

/** PokeAPI api-data の pokemon-species JSON のうち、スナップショット生成が参照する要素。 */
export interface PokeAPISpeciesData {
  id: number;
  is_legendary: boolean;
  is_mythical: boolean;
  names: { name: string; language: { name: string } }[];
  flavor_text_entries: {
    flavor_text: string;
    language: { name: string };
    version: { name: string };
  }[];
}

/** PokeAPI api-data の pokemon JSON のうち、スナップショット生成が参照する要素。 */
export interface PokeAPIPokemonData {
  stats: { base_stat: number }[];
  types: { type: { name: string } }[];
  height: number;
  weight: number;
  moves: PokeAPIMoveEntry[];
}

/**
 * flavor text の制御文字・連続空白を整形する。
 * @param text PokeAPI の生の flavor_text。
 * @returns 整形済みテキスト。
 */
export function cleanFlavorText(text: string): string {
  return text
    .replace(/\f/g, " ")
    .replace(/\n/g, " ")
    .replace(/\r/g, " ")
    .replace(/ {2,}/g, " ")
    .trim();
}

/**
 * PokeAPI の species / pokemon データをスナップショットのポケモンレコードへ変換する。
 * @param species pokemon-species の JSON。
 * @param pokemon pokemon の JSON。
 * @param hintMoveCandidates レベルアップで覚えうる技の日本語名の候補 (呼び出し元で解決済み)。
 * @returns 変換済みのポケモンレコード (sprite_url は含まない)。
 * @throws EN/JA 説明ペアが無い、または未知のタイプが含まれる場合。
 */
export function convertToPokemonRecord(
  species: PokeAPISpeciesData,
  pokemon: PokeAPIPokemonData,
  hintMoveCandidates: string[],
): PokemonRecord {
  let nameEN = "";
  let nameJA = "";
  for (const n of species.names) {
    if (n.language.name === "en") nameEN = n.name;
    if (n.language.name === "ja") nameJA = n.name;
  }

  const flavorTexts = buildFlavorTextPairs(
    species.flavor_text_entries.map((entry) => ({
      version: entry.version.name,
      language: entry.language.name,
      text: cleanFlavorText(entry.flavor_text),
    })),
  );
  if (flavorTexts.length === 0) {
    throw new Error(`no EN/JA description pair found for pokemon ${species.id}`);
  }

  const bst = pokemon.stats.reduce((sum, s) => sum + s.base_stat, 0);
  const types = pokemon.types.map((t) => toPokemonType(t.type.name));

  return {
    id: species.id,
    name_en: nameEN,
    name_ja: nameJA,
    description_en: flavorTexts[0].description_en,
    description_ja: flavorTexts[0].description_ja,
    base_stat_total: bst,
    types,
    height: pokemon.height,
    weight: pokemon.weight,
    is_legendary: species.is_legendary,
    is_mythical: species.is_mythical,
    flavor_texts: flavorTexts,
    hint_move_candidates: hintMoveCandidates,
  };
}
