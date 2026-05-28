import { ExternalServiceError } from "../apperror/apperror.js";
import type { PokemonFetcher, UserPokemonRepository } from "../domain/interfaces.js";
import type { FlavorTextPair, UserPokemon } from "../types/index.js";

/** 図鑑一覧の 1 エントリ。ユーザ実績と表示用のポケモン基本情報を含む。 */
export interface CollectionEntry {
  pokemon_id: number;
  name_en: string;
  name_ja: string;
  sprite_url: string;
  status: string;
  total_captures: number;
  best_score: number;
}

/** ポケモン詳細レスポンス。ユーザ実績と PokeAPI 情報を合成して返す。 */
export interface PokemonDetailResponse extends UserPokemon {
  name_en: string;
  name_ja: string;
  description_en: string;
  description_ja: string;
  sprite_url: string;
  types: string[];
  height: number;
  weight: number;
  flavor_texts?: FlavorTextPair[];
}

/** 図鑑コレクションの取得・整形ロジックを束ねるサービス。 */
export class CollectionService {
  private repo: UserPokemonRepository;
  private pokemonFetcher: PokemonFetcher;

  constructor(repo: UserPokemonRepository, pokemonFetcher: PokemonFetcher) {
    this.repo = repo;
    this.pokemonFetcher = pokemonFetcher;
  }

  /** ユーザの図鑑一覧を取得し、PokeAPI からのメタ情報を付与して返す。 */
  async getCollection(uid: string): Promise<CollectionEntry[]> {
    const pokemons = await this.repo.getCollection(uid);
    const entries: CollectionEntry[] = [];

    for (const up of pokemons) {
      try {
        const pokemon = await this.pokemonFetcher.getPokemonByID(up.pokemon_id);
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
        console.warn(`failed to fetch pokemon data, skipping pokemon_id=${up.pokemon_id}`, err);
      }
    }

    return entries;
  }

  /** 特定ポケモンのユーザ実績と PokeAPI 詳細を合成して返す。 */
  async getPokemonDetail(uid: string, pokemonID: number): Promise<PokemonDetailResponse> {
    const userPokemon = await this.repo.getPokemon(uid, pokemonID);

    let pokemon;
    try {
      pokemon = await this.pokemonFetcher.getPokemonByID(pokemonID);
    } catch (err) {
      throw new ExternalServiceError("PokeAPI", err as Error);
    }

    return {
      ...userPokemon,
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
