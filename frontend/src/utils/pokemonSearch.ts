import { hiraganaToKatakana } from "./kana";

/**
 * クエリの前方一致でポケモンを検索する。
 * name_ja はカタカナ表記のため、クエリはひらがなをカタカナへ正規化してから比較する。
 * 先頭がクエリと完全に一致する候補だけを、五十音順に並べて返す。
 * @param entries 検索対象のポケモン一覧。
 * @param query 検索クエリ。
 * @returns 前方一致する候補 (クエリが空文字なら空配列)。
 */
export function searchPokemonByName<T extends { name_ja: string }>(entries: T[], query: string): T[] {
  if (query === "") return [];
  const normalizedQuery = hiraganaToKatakana(query);
  return entries
    .filter((entry) => entry.name_ja.startsWith(normalizedQuery))
    .sort((a, b) => a.name_ja.localeCompare(b.name_ja, "ja"));
}
