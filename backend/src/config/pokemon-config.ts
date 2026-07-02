import type { getFirestore } from "firebase-admin/firestore";

/** 出題プール上限 ID の既定値 (Firestore の config/app.max_pokemon_id 未設定・型不正時に使用)。 */
export const DEFAULT_MAX_POKEMON_ID = 898;

/**
 * Firestore の config/app から出題プール上限ポケモン ID を読み込む。未設定・型不正なら既定値。
 * @param firestoreClient Firestore クライアント。
 * @returns 出題プールの上限ポケモン ID。
 */
export async function loadMaxPokemonID(
  firestoreClient: ReturnType<typeof getFirestore>,
): Promise<number> {
  const doc = await firestoreClient.collection("config").doc("app").get();
  if (!doc.exists) return DEFAULT_MAX_POKEMON_ID;
  const data = doc.data();
  return typeof data?.max_pokemon_id === "number" ? data.max_pokemon_id : DEFAULT_MAX_POKEMON_ID;
}
