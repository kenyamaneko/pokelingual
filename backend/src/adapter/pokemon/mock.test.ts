import { describe, it, expect } from "vitest";
import { MockPokemonClient } from "./mock.js";
import { MockRandomSource } from "../random/mock.js";

// mock 固定リストの図鑑番号を包含する十分広い許可集合 (全許可の代用)。
const ALL_ALLOWED = new Set(Array.from({ length: 1000 }, (_, i) => i + 1));

/**
 * mock アダプタの抽選は allowedIds に含まれる図鑑番号のポケモンだけを返す。
 * 実データ ID を直接書かず、返り値が許可集合に含まれることで振る舞いを確かめる。
 */
describe("MockPokemonClient.getRandomPokemon", () => {
  it("allowedIds に含まれる図鑑番号のポケモンを返す", async () => {
    const client = new MockPokemonClient(new MockRandomSource());
    const pokemon = await client.getRandomPokemon(ALL_ALLOWED);
    expect(ALL_ALLOWED.has(pokemon.id)).toBe(true);
  });

  it("許可集合から除いた図鑑番号のポケモンは返さない", async () => {
    const client = new MockPokemonClient(new MockRandomSource());
    const first = await client.getRandomPokemon(ALL_ALLOWED);
    const withoutFirst = new Set([...ALL_ALLOWED].filter((id) => id !== first.id));
    const second = await client.getRandomPokemon(withoutFirst);
    expect(second.id).not.toBe(first.id);
    expect(withoutFirst.has(second.id)).toBe(true);
  });

  it("許可された図鑑番号のポケモンが固定リストに無ければエラー", async () => {
    const client = new MockPokemonClient(new MockRandomSource());
    await expect(client.getRandomPokemon(new Set([9999]))).rejects.toThrow(/no mock pokemon/);
  });
});
