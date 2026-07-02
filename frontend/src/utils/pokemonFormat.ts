/**
 * 図鑑番号 (例: 25) を 3 桁ゼロパディング文字列 (例: "025") に整形する。
 * @param id 図鑑番号。
 * @returns 3 桁ゼロパディングした文字列。
 */
export function formatPokemonId(id: number): string {
  const POKEMON_ID_DIGITS = 3;
  return String(id).padStart(POKEMON_ID_DIGITS, "0");
}

/**
 * PokeAPI のデシメートル単位 height を「メートル小数1桁」表記に整形する。
 * @param heightDm デシメートル単位の高さ。
 * @returns メートル小数1桁の文字列。
 */
export function formatHeightMeters(heightDm: number): string {
  const DECIMETERS_PER_METER = 10;
  return (heightDm / DECIMETERS_PER_METER).toFixed(1);
}

/**
 * PokeAPI のヘクトグラム単位 weight を「キログラム小数1桁」表記に整形する。
 * @param weightHg ヘクトグラム単位の重さ。
 * @returns キログラム小数1桁の文字列。
 */
export function formatWeightKilograms(weightHg: number): string {
  const HECTOGRAMS_PER_KILOGRAM = 10;
  return (weightHg / HECTOGRAMS_PER_KILOGRAM).toFixed(1);
}
