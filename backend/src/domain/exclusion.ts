import type { AppEnvironment } from "./environment.js";

// 開発者が苦手で、名前すら見たくない 6 匹。名称・種名をコードに残さないため ID のみで扱う。
const DEVELOPER_EXCLUDED_POKEMON_IDS: readonly number[] = [167, 168, 595, 596, 751, 752];

/**
 * 出題・図鑑から除外するポケモン ID の集合を作る。
 * ユーザー設定による除外は全環境で適用し、prod 以外の環境では開発者除外を合成する。
 * @param environment 実行環境。
 * @param userConfiguredIDs ユーザーが設定で除外したポケモン ID (未設定なら null)。
 * @returns 除外するポケモン ID の集合。
 */
export function buildExcludedPokemonIDs(
  environment: AppEnvironment,
  userConfiguredIDs: readonly number[] | null,
): Set<number> {
  const developerIDs = environment === "prod" ? [] : DEVELOPER_EXCLUDED_POKEMON_IDS;
  return new Set<number>([...(userConfiguredIDs ?? []), ...developerIDs]);
}
