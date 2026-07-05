import type { HttpGet, PokemonClient, PokemonConfig, RandomSource } from "../../domain/ports.js";
import type { Pokemon } from "../../domain/pokemon.js";
import { buildFlavorTextPairs } from "../../domain/flavor-text.js";
import type { PokemonType } from "../../../../shared/api-types/pokemon.js";

/** PokemonType の全 18 種 (PokeAPI 由来の値の実行時検証用)。shared の PokemonType と一致させる。 */
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
    throw new Error(`unknown pokemon type from PokeAPI: ${name}`);
  }
  return name as PokemonType;
}

interface PokeAPISpeciesResponse {
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

interface PokeAPIPokemonResponse {
  sprites: {
    front_default: string;
    other: { "official-artwork": { front_default: string } };
  };
  stats: { base_stat: number }[];
  types: { type: { name: string } }[];
  height: number;
  weight: number;
}

/** PokeAPI から種別情報を取得しメモリキャッシュする PokemonClient 実装。 */
export class PokeAPIClient implements PokemonClient {
  private cache = new Map<number, Pokemon>();

  /**
   * @param config ポケモン関連のアプリ設定 (maxPokemonID 等)。
   * @param random 乱数ソース (抽選を RandomSource ポート経由に統一する)。
   * @param httpGet HTTP トランスポート。本番は fetch、テストは fake を注入する。
   */
  constructor(
    private config: PokemonConfig,
    private random: RandomSource,
    private httpGet: HttpGet,
  ) {}

  /**
   * 許可された図鑑番号の中からランダムに 1 匹取得する。
   * @param allowedIds 出題を許可する図鑑番号の集合 (選択世代 ∩ 上限 − 除外)。
   * @returns ランダムに選ばれたポケモン。
   * @throws 許可された図鑑番号が無い場合。
   */
  async getRandomPokemon(allowedIds: ReadonlySet<number>): Promise<Pokemon> {
    const ids = [...allowedIds];
    if (ids.length === 0) {
      throw new Error("no pokemon id available in the allowed pool");
    }
    const id = ids[Math.floor(this.random.next() * ids.length)];
    return this.getPokemonByID(id);
  }

  /**
   * ID 指定でポケモンを取得する (メモリキャッシュ経由)。
   * @param id ポケモン ID。
   * @returns 該当ポケモン。
   */
  async getPokemonByID(id: number): Promise<Pokemon> {
    const cached = this.cache.get(id);
    if (cached) return cached;

    const pokemon = await this.fetchFromAPI(id);
    this.cache.set(id, pokemon);
    return pokemon;
  }

  /**
   * PokeAPI から species/pokemon を取得し内部表現へ変換する。
   * @param id ポケモン ID。
   * @returns 変換済みのポケモン情報。
   * @throws API がエラーを返す、または EN/JA 説明ペアが無い場合。
   */
  private async fetchFromAPI(id: number): Promise<Pokemon> {
    const [speciesResp, pokemonResp] = await Promise.all([
      this.httpGet(`https://pokeapi.co/api/v2/pokemon-species/${id}`),
      this.httpGet(`https://pokeapi.co/api/v2/pokemon/${id}`),
    ]);

    if (!speciesResp.ok) throw new Error(`species API returned status ${speciesResp.status}`);
    if (!pokemonResp.ok) throw new Error(`pokemon API returned status ${pokemonResp.status}`);

    const species = (await speciesResp.json()) as PokeAPISpeciesResponse;
    const pokemonData = (await pokemonResp.json()) as PokeAPIPokemonResponse;

    let nameEN = "";
    let nameJA = "";
    for (const n of species.names) {
      if (n.language.name === "en") nameEN = n.name;
      if (n.language.name === "ja") nameJA = n.name;
    }

    // wire 形式を中立形に写像してから、ペア整形は domain の純関数に委ねる
    const flavorTexts = buildFlavorTextPairs(
      species.flavor_text_entries.map((entry) => ({
        version: entry.version.name,
        language: entry.language.name,
        text: cleanFlavorText(entry.flavor_text),
      })),
    );
    if (flavorTexts.length === 0) {
      throw new Error(`no EN/JA description pair found for pokemon ${id}`);
    }

    const bst = pokemonData.stats.reduce((sum, s) => sum + s.base_stat, 0);
    const types = pokemonData.types.map((t) => toPokemonType(t.type.name));
    const spriteURL =
      pokemonData.sprites.other["official-artwork"].front_default ||
      pokemonData.sprites.front_default;

    return {
      id,
      name_en: nameEN,
      name_ja: nameJA,
      description_en: flavorTexts[0].description_en,
      description_ja: flavorTexts[0].description_ja,
      sprite_url: spriteURL,
      base_stat_total: bst,
      types,
      height: pokemonData.height,
      weight: pokemonData.weight,
      is_legendary: species.is_legendary,
      is_mythical: species.is_mythical,
      flavor_texts: flavorTexts,
    };
  }
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
