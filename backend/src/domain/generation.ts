/**
 * 全国図鑑での世代境界。start/end は両端を含む図鑑番号。対象は第1〜8世代 (maxPokemonID=898 に対応)。
 */
export const GENERATION_RANGES = [
  { generation: 1, start: 1, end: 151 },
  { generation: 2, start: 152, end: 251 },
  { generation: 3, start: 252, end: 386 },
  { generation: 4, start: 387, end: 493 },
  { generation: 5, start: 494, end: 649 },
  { generation: 6, start: 650, end: 721 },
  { generation: 7, start: 722, end: 809 },
  { generation: 8, start: 810, end: 898 },
] as const;

/** 選択可能な全世代の番号 (第1〜8世代)。 */
export const ALL_GENERATIONS: number[] = GENERATION_RANGES.map((r) => r.generation);

/**
 * 選択世代を、上限内の図鑑番号 ID 集合に展開する。
 * @param generations 選択された世代番号。
 * @param maxPokemonID 出題対象の図鑑番号上限。
 * @returns 選択世代に含まれ、かつ上限以内の図鑑番号の集合。
 */
export function generationsToPokemonIDs(
  generations: readonly number[],
  maxPokemonID: number,
): Set<number> {
  const selected = new Set(generations);
  const ids = new Set<number>();
  for (const range of GENERATION_RANGES) {
    if (!selected.has(range.generation)) continue;
    const end = Math.min(range.end, maxPokemonID);
    for (let id = range.start; id <= end; id++) {
      ids.add(id);
    }
  }
  return ids;
}

/**
 * 出題プールの図鑑番号 ID 集合を作る。選択世代を上限内で展開し、除外 ID を差し引く。
 * @param generations 選択された世代番号。
 * @param maxPokemonID 出題対象の図鑑番号上限。
 * @param excludedIDs 除外する図鑑番号。
 * @returns 出題プールの図鑑番号の集合。
 */
export function buildQuestPoolIDs(
  generations: readonly number[],
  maxPokemonID: number,
  excludedIDs: ReadonlySet<number>,
): Set<number> {
  const ids = generationsToPokemonIDs(generations, maxPokemonID);
  for (const excluded of excludedIDs) {
    ids.delete(excluded);
  }
  return ids;
}

/** 選択世代の検証結果。ok=false のとき message に 400 用の理由を持つ。 */
export type EnabledGenerationsValidation =
  | { ok: true; generations: number[] }
  | { ok: false; message: string };

/**
 * 出題対象の世代リストをバリデーションし、正規化 (重複排除・昇順) して返す。
 * 空 (最低1世代未満) と未知の世代番号は失敗にする。
 * @param raw リクエストで受け取った未バリデーションの値。
 * @returns 検証済み世代配列、または理由付きの失敗。
 */
export function validateEnabledGenerations(raw: unknown): EnabledGenerationsValidation {
  if (!Array.isArray(raw)) {
    return { ok: false, message: "generations must be an array" };
  }
  const valid = new Set(ALL_GENERATIONS);
  for (const v of raw) {
    if (typeof v !== "number" || !valid.has(v)) {
      return { ok: false, message: `unknown generation: ${String(v)} (must be one of ${ALL_GENERATIONS.join(",")})` };
    }
  }
  const deduped = [...new Set(raw as number[])].sort((a, b) => a - b);
  if (deduped.length === 0) {
    return { ok: false, message: "at least one generation must be selected" };
  }
  return { ok: true, generations: deduped };
}
