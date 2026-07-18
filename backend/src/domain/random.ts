import type { RandomSource } from "./ports.js";

/**
 * プールから重複無く count 件をランダムに選ぶ。
 * @param pool 選択候補。
 * @param count 選ぶ件数。
 * @param random 乱数ソース。
 * @returns ランダムに選ばれた要素 (pool.length < count なら pool 全件)。
 */
export function pickRandomSample<T>(pool: readonly T[], count: number, random: RandomSource): T[] {
  const remaining = [...pool];
  const picked: T[] = [];
  const n = Math.min(count, remaining.length);
  for (let i = 0; i < n; i++) {
    const index = Math.floor(random.next() * remaining.length);
    picked.push(remaining.splice(index, 1)[0]);
  }
  return picked;
}
