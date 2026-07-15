/** 除外ポケモンID の検証結果。ok=false のとき message に 400 用の理由を持つ。 */
export type ExcludedIDsValidation =
  | { ok: true; ids: number[] }
  | { ok: false; message: string };

/**
 * 除外ポケモンID リストをバリデーションし、正規化 (重複排除・昇順) して返す。
 * @param raw リクエストで受け取った未バリデーションの値。
 * @param servableIDs 供給可能な図鑑番号の集合。この集合に無い ID は許可しない。
 * @param maxCount 除外できる最大件数。
 * @returns 検証済み ID 配列、または理由付きの失敗。
 */
export function validateExcludedPokemonIDs(
  raw: unknown,
  servableIDs: ReadonlySet<number>,
  maxCount: number,
): ExcludedIDsValidation {
  if (!Array.isArray(raw)) {
    return { ok: false, message: "excluded_pokemon_ids must be an array" };
  }
  for (const v of raw) {
    if (typeof v !== "number" || !Number.isInteger(v) || !servableIDs.has(v)) {
      return { ok: false, message: `pokemon id not in pokedex: ${String(v)}` };
    }
  }
  const deduped = [...new Set(raw as number[])].sort((a, b) => a - b);
  if (deduped.length > maxCount) {
    return { ok: false, message: `excluded_pokemon_ids exceeds limit (max ${maxCount})` };
  }
  return { ok: true, ids: deduped };
}
