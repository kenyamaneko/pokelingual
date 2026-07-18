/** 技の習得方法・バージョングループの1件 (PokeAPI pokemon.moves[].version_group_details の要素)。 */
export interface PokeAPIMoveVersionGroupDetail {
  level_learned_at: number;
  move_learn_method: { name: string };
  version_group: { name: string };
}

/** PokeAPI pokemon.moves[] の要素。 */
export interface PokeAPIMoveEntry {
  move: { name: string; url: string };
  version_group_details: PokeAPIMoveVersionGroupDetail[];
}

/** 技の言語別名称 (PokeAPI move.names[] の要素)。 */
export interface PokeAPIMoveName {
  name: string;
  language: { name: string };
}

/**
 * レベルアップ技解決の対象とする version_group。新しい作品から優先して採用する
 * (flavor-text.ts の displayVersions と同型の優先順リスト)。ある種がその作品の
 * 図鑑に登場しないと、その version_group のレベルアップ技データを持たないため
 * 遡って次点を試す。
 */
const LEVEL_UP_VERSION_GROUP_PRIORITY: readonly string[] = [
  "sword-shield",
  "the-isle-of-armor",
  "the-crown-tundra",
  "lets-go-pikachu-lets-go-eevee",
  "ultra-sun-ultra-moon",
  "sun-moon",
  "omega-ruby-alpha-sapphire",
  "x-y",
];

/** レベルアップ技の候補1件 (slug と PokeAPI 上の技 ID)。 */
export interface MoveCandidate {
  slug: string;
  id: number;
}

/**
 * PokeAPI の URL 末尾の数値 ID を取り出す。
 * @param url 例: "https://pokeapi.co/api/v2/move/13/"。
 * @returns 数値 ID。
 * @throws URL から ID が取り出せない場合。
 */
function extractIdFromUrl(url: string): number {
  const match = /\/(\d+)\/?$/.exec(url);
  if (!match) throw new Error(`cannot extract id from url: ${url}`);
  return Number(match[1]);
}

/**
 * レベルアップ技の候補を、優先順の version_group から解決する。
 * 最新作から遡り、レベルアップ技を持つ最初の version_group を採用する。
 * @param moves pokemon.moves の生データ。
 * @returns 採用した version_group のレベルアップ技候補 (レベル昇順、重複スラッグは除く)。
 * どの version_group にもレベルアップ技が無ければ空配列。
 */
export function resolveLevelUpMoveCandidates(moves: PokeAPIMoveEntry[]): MoveCandidate[] {
  for (const versionGroup of LEVEL_UP_VERSION_GROUP_PRIORITY) {
    const found: { slug: string; id: number; level: number }[] = [];
    for (const entry of moves) {
      for (const detail of entry.version_group_details) {
        if (detail.version_group.name === versionGroup && detail.move_learn_method.name === "level-up") {
          found.push({ slug: entry.move.name, id: extractIdFromUrl(entry.move.url), level: detail.level_learned_at });
        }
      }
    }
    if (found.length === 0) continue;

    found.sort((a, b) => a.level - b.level);
    const seenSlugs = new Set<string>();
    const deduped: MoveCandidate[] = [];
    for (const f of found) {
      if (seenSlugs.has(f.slug)) continue;
      seenSlugs.add(f.slug);
      deduped.push({ slug: f.slug, id: f.id });
    }
    return deduped;
  }
  return [];
}

/**
 * 技の日本語名を解決する。
 * @param names PokeAPI move.names の生データ。
 * @returns 日本語名 (ja、無ければ ja-Hrkt)。
 * @throws 日本語名 (ja / ja-Hrkt) がどちらも無い場合。
 */
export function resolveMoveNameJA(names: PokeAPIMoveName[]): string {
  let ja = "";
  let jaHrkt = "";
  for (const n of names) {
    if (n.language.name === "ja") ja = n.name;
    if (n.language.name === "ja-Hrkt") jaHrkt = n.name;
  }
  const resolved = ja || jaHrkt;
  if (!resolved) throw new Error("no japanese name found for move");
  return resolved;
}

/**
 * レベルアップ技候補を日本語名の一覧に変換する。選出 (何件見せるか) は行わない。
 * @param candidates レベルアップ技候補。
 * @param moveNamesJA 技 slug から日本語名への対応表。
 * @returns candidates と対応する日本語名の一覧 (candidates の順序を保つ)。
 * @throws 候補の技が moveNamesJA に無い場合 (呼び出し元の事前解決漏れ)。
 */
export function resolveHintMoveCandidateNames(
  candidates: MoveCandidate[],
  moveNamesJA: ReadonlyMap<string, string>,
): string[] {
  return candidates.map((c) => {
    const ja = moveNamesJA.get(c.slug);
    if (!ja) throw new Error(`no resolved japanese name for move: ${c.slug}`);
    return ja;
  });
}
