import { describe, it, expect } from "vitest";
import type { getFirestore } from "firebase-admin/firestore";
import { loadMaxPokemonID } from "./pokemon-config.js";

// Firestore は外部境界なので、config/app の取得結果だけを固定したスタブに差し替える。

/**
 * config/app ドキュメントの取得結果を固定した Firestore クライアントのスタブを作る。
 * @param doc get() が返すドキュメントスナップショット相当。
 * @returns loadMaxPokemonID に渡す Firestore クライアントスタブ。
 */
function stubFirestore(doc: {
  exists: boolean;
  data?: () => Record<string, unknown>;
}): ReturnType<typeof getFirestore> {
  return {
    collection: () => ({ doc: () => ({ get: async () => doc }) }),
  } as unknown as ReturnType<typeof getFirestore>;
}

describe("loadMaxPokemonID", () => {
  it("config ドキュメントが無ければ既定値になる", async () => {
    const maxPokemonID = await loadMaxPokemonID(stubFirestore({ exists: false }));
    expect(maxPokemonID).toBe(898);
  });

  it("ドキュメントはあるが max_pokemon_id が無ければ既定値になる", async () => {
    const maxPokemonID = await loadMaxPokemonID(stubFirestore({ exists: true, data: () => ({}) }));
    expect(maxPokemonID).toBe(898);
  });

  it("max_pokemon_id が数値でなければ既定値になる", async () => {
    const maxPokemonID = await loadMaxPokemonID(
      stubFirestore({ exists: true, data: () => ({ max_pokemon_id: "151" }) }),
    );
    expect(maxPokemonID).toBe(898);
  });

  it("max_pokemon_id が数値ならその値が反映される", async () => {
    const maxPokemonID = await loadMaxPokemonID(
      stubFirestore({ exists: true, data: () => ({ max_pokemon_id: 151 }) }),
    );
    expect(maxPokemonID).toBe(151);
  });
});
