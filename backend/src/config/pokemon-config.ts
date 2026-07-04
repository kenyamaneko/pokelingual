import type { getFirestore } from "firebase-admin/firestore";
import type { PokemonConfig } from "../domain/ports.js";

/** PokemonConfig の既定値 (Firestore の config/app 未設定時に使用)。 */
export const DEFAULT_POKEMON_CONFIG: PokemonConfig = {
  maxPokemonID: 898,
  defaultExcludedPokemonIDs: [167, 168, 595, 596, 751, 752],
};

/**
 * Firestore の config/app ドキュメントから PokemonConfig を読み込む。未設定・型不正ならデフォルト値。
 * @param firestoreClient Firestore クライアント。
 * @returns 読み込んだ (またはデフォルトの) PokemonConfig。
 */
export async function loadPokemonConfig(
  firestoreClient: ReturnType<typeof getFirestore>,
): Promise<PokemonConfig> {
  const doc = await firestoreClient.collection("config").doc("app").get();
  if (!doc.exists) return DEFAULT_POKEMON_CONFIG;
  const data = doc.data();
  const maxPokemonID = typeof data?.max_pokemon_id === "number"
    ? data.max_pokemon_id
    : DEFAULT_POKEMON_CONFIG.maxPokemonID;
  const defaultExcludedPokemonIDs = Array.isArray(data?.default_excluded_pokemon_ids)
    ? (data.default_excluded_pokemon_ids as number[])
    : DEFAULT_POKEMON_CONFIG.defaultExcludedPokemonIDs;
  return { maxPokemonID, defaultExcludedPokemonIDs };
}
