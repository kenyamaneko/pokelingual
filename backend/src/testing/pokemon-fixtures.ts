import type { PokemonClient } from "../domain/ports.js";
import type { Pokemon } from "../domain/pokemon.js";

/**
 * テスト用のポケモンを作る。既定値は実在ポケモンのデータ。
 * @param overrides 上書きするフィールド。
 * @returns ポケモン。
 */
export function makePokemon(overrides: Partial<Pokemon> = {}): Pokemon {
  return {
    id: 1,
    name_en: "Bulbasaur",
    name_ja: "フシギダネ",
    description_en: "Bulbasaur is fast.",
    description_ja: "フシギダネは 速い。",
    sprite_url: "https://example.com/1.png",
    base_stat_total: 318,
    types: ["grass", "poison"],
    height: 7,
    weight: 69,
    is_legendary: false,
    is_mythical: false,
    ...overrides,
  };
}

/**
 * ポケモンの配列をプールとして扱う PokemonClient スタブを作る。
 * @param pool 取得できるポケモンの一覧。
 * @param o.error 指定すると getPokemonByID がプールを無視してこのエラーを投げる (外部障害の模擬)。
 * @returns プールから抽選対象・詳細・タイプ別 ID を返す PokemonClient。
 */
export function makePokemonClient(pool: Pokemon[], o: { error?: Error } = {}): PokemonClient {
  return {
    getServableIDs: () => pool.map((p) => p.id),
    getPokemonByID: async (id) => {
      if (o.error) throw o.error;
      const found = pool.find((p) => p.id === id);
      if (!found) throw new Error(`not in pool: ${id}`);
      return found;
    },
    getIDsByType: async (type) => pool.filter((p) => p.types.includes(type)).map((p) => p.id),
  };
}
