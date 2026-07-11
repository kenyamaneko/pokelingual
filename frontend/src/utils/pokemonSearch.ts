/**
 * クエリの前方一致でポケモンを検索する。
 * name_ja の先頭がクエリと完全に一致する候補だけを、入力順のまま返す。
 * @param entries 検索対象のポケモン一覧。
 * @param query 検索クエリ。
 * @returns 前方一致する候補 (クエリが空文字なら空配列)。
 */
export function searchPokemonByName<T extends { name_ja: string }>(entries: T[], query: string): T[] {
  if (query === "") return [];
  return entries.filter((entry) => entry.name_ja.startsWith(query));
}
