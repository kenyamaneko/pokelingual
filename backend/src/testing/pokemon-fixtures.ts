import type { PokemonClient } from "../domain/ports.js";
import type { Pokemon } from "../domain/pokemon.js";

/**
 * テスト用のポケモンを作る。
 * @param overrides 上書きするフィールド。
 * @returns ポケモン。
 */
export function makePokemon(overrides: Partial<Pokemon> = {}): Pokemon {
  return {
    id: 1,
    name_en: "Bulbasaur",
    name_ja: "フシギダネ",
    description_en:
      "A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokémon.",
    description_ja: "生まれたときから　背中に 不思議な　タネが　植えてあって 体と　ともに　育つという。",
    sprite_url: "https://example.com/1.png",
    base_stat_total: 318,
    types: ["grass", "poison"],
    height: 7,
    weight: 69,
    is_legendary: false,
    is_mythical: false,
    hint_move_candidates: ["たいあたり", "なきごえ", "つるのムチ"],
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
