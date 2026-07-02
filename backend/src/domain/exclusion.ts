// 開発者が苦手な6匹の図鑑ID。非 prod 環境 (local/dev/stg) でのみ出題・図鑑から除外する。
// 生き物の名称・種名は残さない方針のため、ID のみで扱う。
const DEV_EXCLUDED_POKEMON_IDS: readonly number[] = [167, 168, 595, 596, 751, 752];

/**
 * 実行環境に応じた開発者除外 ID を返す。prod では空 (通常運用)、それ以外では固定リスト。
 * @param environment 実行環境 (local / dev / stg / prod 等)。
 * @returns 除外する図鑑 ID の配列。
 */
export function resolveDevExcludedPokemonIDs(environment: string): readonly number[] {
  return environment === "prod" ? [] : DEV_EXCLUDED_POKEMON_IDS;
}

/**
 * per-user 除外と開発者除外を合成した除外集合を作る。出題抽選・図鑑の両方で使う。
 * @param perUserIDs ユーザー自身が設定した除外 ID (未設定なら null)。
 * @param devIDs 環境由来の開発者除外 ID。
 * @returns 除外する図鑑 ID の集合。
 */
export function buildExcludedPokemonIDs(
  perUserIDs: readonly number[] | null,
  devIDs: readonly number[],
): Set<number> {
  return new Set<number>([...(perUserIDs ?? []), ...devIDs]);
}
