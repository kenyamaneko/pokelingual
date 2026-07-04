import { describe, it, expect } from "vitest";
import type { getFirestore } from "firebase-admin/firestore";
import { loadMaxPokemonID, DEFAULT_MAX_POKEMON_ID } from "./pokemon-config.js";

// Firestore は外部境界なので、config/app の取得結果 (data()) だけを固定したスタブに差し替える。

/**
 * config/app ドキュメントの取得結果を固定した Firestore クライアントのスタブを作る。
 * @param data get() したドキュメントの data() 相当。ドキュメント不在は undefined。
 * @returns loadMaxPokemonID に渡す Firestore クライアントスタブ。
 */
function stubFirestore(data: Record<string, unknown> | undefined): ReturnType<typeof getFirestore> {
  return {
    collection: () => ({ doc: () => ({ get: async () => ({ data: () => data }) }) }),
  } as unknown as ReturnType<typeof getFirestore>;
}

describe("loadMaxPokemonID", () => {
  it("config ドキュメントが無ければ既定値になる", async () => {
    expect(await loadMaxPokemonID(stubFirestore(undefined))).toBe(DEFAULT_MAX_POKEMON_ID);
  });

  it("max_pokemon_id が未設定なら既定値になる", async () => {
    expect(await loadMaxPokemonID(stubFirestore({}))).toBe(DEFAULT_MAX_POKEMON_ID);
  });

  it("max_pokemon_id が正の整数ならその値になる", async () => {
    expect(await loadMaxPokemonID(stubFirestore({ max_pokemon_id: 151 }))).toBe(151);
  });

  it("max_pokemon_id が数値でなければ起動エラーになる", async () => {
    await expect(loadMaxPokemonID(stubFirestore({ max_pokemon_id: "151" }))).rejects.toThrow();
  });

  it("max_pokemon_id が整数でなければ起動エラーになる", async () => {
    await expect(loadMaxPokemonID(stubFirestore({ max_pokemon_id: 1.5 }))).rejects.toThrow();
  });

  it("max_pokemon_id が 0 以下なら起動エラーになる", async () => {
    await expect(loadMaxPokemonID(stubFirestore({ max_pokemon_id: 0 }))).rejects.toThrow();
  });
});
