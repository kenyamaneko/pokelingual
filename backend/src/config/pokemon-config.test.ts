import { describe, it, expect } from "vitest";
import type { getFirestore } from "firebase-admin/firestore";
import { loadPokemonConfig } from "./pokemon-config.js";

// Firestore は外部境界なので、config/app の取得結果だけを固定したスタブに差し替える。

/**
 * config/app ドキュメントの取得結果を固定した Firestore クライアントのスタブを作る。
 * @param doc get() が返すドキュメントスナップショット相当。
 * @returns loadPokemonConfig に渡す Firestore クライアントスタブ。
 */
function stubFirestore(doc: {
  exists: boolean;
  data?: () => Record<string, unknown>;
}): ReturnType<typeof getFirestore> {
  return {
    collection: () => ({ doc: () => ({ get: async () => doc }) }),
  } as unknown as ReturnType<typeof getFirestore>;
}

describe("loadPokemonConfig", () => {
  it("config ドキュメントが無ければ既定値になる", async () => {
    const cfg = await loadPokemonConfig(stubFirestore({ exists: false }));
    expect(cfg.maxPokemonID).toBe(898);
    expect(cfg.defaultExcludedPokemonIDs).toEqual([167, 168, 595, 596, 751, 752]);
  });

  it("ドキュメントはあるが両フィールドが無ければ両方とも既定値になる", async () => {
    const cfg = await loadPokemonConfig(stubFirestore({ exists: true, data: () => ({}) }));
    expect(cfg.maxPokemonID).toBe(898);
    expect(cfg.defaultExcludedPokemonIDs).toEqual([167, 168, 595, 596, 751, 752]);
  });

  it("max_pokemon_id が数値でなければその項目だけ既定値になり、他の項目は反映される", async () => {
    const cfg = await loadPokemonConfig(
      stubFirestore({
        exists: true,
        data: () => ({ max_pokemon_id: "151", default_excluded_pokemon_ids: [10] }),
      }),
    );
    expect(cfg.maxPokemonID).toBe(898);
    expect(cfg.defaultExcludedPokemonIDs).toEqual([10]);
  });

  it("default_excluded_pokemon_ids が配列でなければその項目だけ既定値になり、他の項目は反映される", async () => {
    const cfg = await loadPokemonConfig(
      stubFirestore({
        exists: true,
        data: () => ({ max_pokemon_id: 151, default_excluded_pokemon_ids: "10" }),
      }),
    );
    expect(cfg.maxPokemonID).toBe(151);
    expect(cfg.defaultExcludedPokemonIDs).toEqual([167, 168, 595, 596, 751, 752]);
  });

  it("両フィールドが正しい型なら設定値がそのまま反映される", async () => {
    const cfg = await loadPokemonConfig(
      stubFirestore({
        exists: true,
        data: () => ({ max_pokemon_id: 151, default_excluded_pokemon_ids: [1, 2] }),
      }),
    );
    expect(cfg.maxPokemonID).toBe(151);
    expect(cfg.defaultExcludedPokemonIDs).toEqual([1, 2]);
  });
});
