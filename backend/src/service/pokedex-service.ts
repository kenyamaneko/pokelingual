import { ExternalServiceError } from "../domain/errors.js";
import { logger } from "../util/logger.js";
import type { PokemonClient, UserPokemonRepository } from "../domain/ports.js";
import type {
  PokedexEntry,
  PokemonDetailResponse,
} from "../../../shared/api-types/pokedex.js";

// PokedexEntry / PokemonDetailResponse / FlavorTextPair の API 契約型は shared/api-types/pokedex.d.ts を参照

/** getPokedex の戻り値。表示可能なエントリと、PokeAPI 取得失敗で除外された件数を返す。 */
interface PokedexResult {
  entries: PokedexEntry[];
  unavailable_count: number;
}

/** 図鑑コレクションの取得・整形ロジックを束ねるサービス。 */
export class PokedexService {
  private repo: UserPokemonRepository;
  private pokemonClient: PokemonClient;

  /**
   * @param repo ユーザの図鑑進捗リポジトリ。
   * @param pokemonClient ポケモンのメタ情報取得クライアント。
   */
  constructor(repo: UserPokemonRepository, pokemonClient: PokemonClient) {
    this.repo = repo;
    this.pokemonClient = pokemonClient;
  }

  /**
   * ユーザの図鑑一覧を取得し、PokeAPI からのメタ情報を付与して返す。
   * @param userId ユーザ ID。
   * @returns 表示可能なエントリと、取得失敗で除外された件数。
   */
  async getPokedex(userId: string): Promise<PokedexResult> {
    const pokemons = await this.repo.getPokedex(userId);
    const entries: PokedexEntry[] = [];
    let unavailableCount = 0;

    for (const up of pokemons) {
      try {
        const pokemon = await this.pokemonClient.getPokemonByID(up.pokemon_id);
        entries.push({
          pokemon_id: up.pokemon_id,
          name_en: pokemon.name_en,
          name_ja: pokemon.name_ja,
          sprite_url: pokemon.sprite_url,
          status: up.status,
          total_captures: up.total_captures,
          best_score: up.best_score,
        });
      } catch (err) {
        // PokeAPI 単体の取得失敗を全体失敗にすると図鑑が完全に開けなくなる。
        // 件数をクライアントに伝えてユーザにフィードバックする方針。
        unavailableCount++;
        logger.error("failed to fetch pokemon data", { pokemon_id: up.pokemon_id, error: String(err) });
      }
    }

    return { entries, unavailable_count: unavailableCount };
  }

  /**
   * 特定ポケモンのユーザ実績と PokeAPI 詳細を合成して返す。
   * @param userId ユーザ ID。
   * @param pokemonID ポケモン ID。
   * @returns ユーザ実績と PokeAPI 詳細を合成したレスポンス。
   */
  async getPokemonDetail(userId: string, pokemonID: number): Promise<PokemonDetailResponse> {
    const userPokemon = await this.repo.getPokemon(userId, pokemonID);

    let pokemon;
    try {
      pokemon = await this.pokemonClient.getPokemonByID(pokemonID);
    } catch (err) {
      throw new ExternalServiceError("PokeAPI", err as Error);
    }

    return {
      pokemon_id: userPokemon.pokemon_id,
      status: userPokemon.status,
      total_captures: userPokemon.total_captures,
      total_encounters: userPokemon.total_encounters,
      // HTTP wire 形式 (ISO 8601 文字列) に揃える。JSON.stringify の暗黙変換に頼らず明示する。
      last_captured_at: userPokemon.last_captured_at?.toISOString() ?? null,
      last_encountered_at: userPokemon.last_encountered_at.toISOString(),
      best_score: userPokemon.best_score,
      name_en: pokemon.name_en,
      name_ja: pokemon.name_ja,
      description_en: pokemon.description_en,
      description_ja: pokemon.description_ja,
      sprite_url: pokemon.sprite_url,
      types: pokemon.types,
      height: pokemon.height,
      weight: pokemon.weight,
      flavor_texts: pokemon.flavor_texts,
    };
  }
}
