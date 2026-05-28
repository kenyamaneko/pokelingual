/** 図鑑番号 (例: 25) を 3 桁ゼロパディング文字列 (例: "025") に整形する。 */
export function formatPokemonId(id: number): string {
  const POKEMON_ID_DIGITS = 3;
  return String(id).padStart(POKEMON_ID_DIGITS, "0");
}

/** PokeAPI のデシメートル単位 height を「メートル小数1桁」表記に整形する。 */
export function formatHeightMeters(heightDm: number): string {
  const DECIMETERS_PER_METER = 10;
  return (heightDm / DECIMETERS_PER_METER).toFixed(1);
}

/** PokeAPI のヘクトグラム単位 weight を「キログラム小数1桁」表記に整形する。 */
export function formatWeightKilograms(weightHg: number): string {
  const HECTOGRAMS_PER_KILOGRAM = 10;
  return (weightHg / HECTOGRAMS_PER_KILOGRAM).toFixed(1);
}
