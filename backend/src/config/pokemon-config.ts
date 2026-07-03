import type { getFirestore } from "firebase-admin/firestore";

// 対象バージョン (X〜ソード/シールド) の EN/JA 説明文が揃うのが第8世代までのため、その全国図鑑上限に合わせる
export const DEFAULT_MAX_POKEMON_ID = 898;

/**
 * 出題・図鑑の対象とする図鑑番号の上限を返す。運用で変更できるよう Firestore の
 * config/app ドキュメント (max_pokemon_id) で上書きでき、未設定なら既定値。
 * @param firestoreClient Firestore クライアント。
 * @returns 図鑑番号の上限。
 * @throws max_pokemon_id が正の整数でない場合。
 */
export async function loadMaxPokemonID(
  firestoreClient: ReturnType<typeof getFirestore>,
): Promise<number> {
  const doc = await firestoreClient.collection("config").doc("app").get();
  const value = doc.data()?.max_pokemon_id;
  if (value === undefined) return DEFAULT_MAX_POKEMON_ID;
  // 型不正を既定値に倒すと設定ミスに気づけないため、起動時に失敗させる
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`invalid config/app.max_pokemon_id: ${JSON.stringify(value)}`);
  }
  return value;
}
