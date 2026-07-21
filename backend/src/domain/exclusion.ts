/**
 * 出題・図鑑から除外するポケモン ID の集合を作る。ユーザー設定による除外を全環境で適用する。
 * @param userConfiguredIDs ユーザーが設定で除外したポケモン ID (未設定なら null)。
 * @returns 除外するポケモン ID の集合。
 */
export function buildExcludedPokemonIDs(userConfiguredIDs: readonly number[] | null): Set<number> {
  return new Set<number>(userConfiguredIDs ?? []);
}
