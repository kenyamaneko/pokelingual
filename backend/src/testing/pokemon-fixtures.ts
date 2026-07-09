import type { PokemonClient } from "../domain/ports.js";
import type { Pokemon } from "../domain/pokemon.js";

/**
 * テスト用のダミーポケモンを作る。
 * @param overrides 上書きするフィールド。
 * @returns ダミーポケモン。
 */
export function makePokemon(overrides: Partial<Pokemon> = {}): Pokemon {
  return {
    id: 1,
    name_en: "Testmon",
    name_ja: "テストモン",
    description_en: "Testmon is fast.",
    description_ja: "テストモンは 速い。",
    sprite_url: "https://example.com/1.png",
    base_stat_total: 300,
    types: ["normal"],
    height: 1,
    weight: 1,
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
