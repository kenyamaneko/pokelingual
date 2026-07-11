function commonPrefixLength(name: string, query: string): number {
  const max = Math.min(name.length, query.length);
  let i = 0;
  while (i < max && name[i] === query[i]) i++;
  return i;
}

/**
 * クエリの前方一致でポケモンを検索する。
 * 先頭 1 文字も一致しない候補は除外し、クエリとの一致文字数が多い候補ほど上位に並べる。
 * @param entries 検索対象のポケモン一覧。
 * @param query 検索クエリ。
 * @returns 一致文字数の降順に並んだ候補 (クエリが空文字なら空配列)。
 */
export function searchPokemonByName<T extends { name_ja: string }>(entries: T[], query: string): T[] {
  if (query === "") return [];
  return entries
    .filter((entry) => commonPrefixLength(entry.name_ja, query) > 0)
    .sort((a, b) => commonPrefixLength(b.name_ja, query) - commonPrefixLength(a.name_ja, query));
}
