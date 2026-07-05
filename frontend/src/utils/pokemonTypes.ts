import type { PokemonType } from "../../../shared/api-types/pokemon";

/** ポケモンタイプ名から Tailwind 背景色クラスへのマップ。全 18 種を網羅する (Record が網羅性を保証)。 */
const typeColors: Record<PokemonType, string> = {
  normal: "bg-gray-400",
  fire: "bg-red-500",
  water: "bg-blue-500",
  electric: "bg-yellow-400",
  grass: "bg-green-500",
  ice: "bg-blue-200",
  fighting: "bg-red-700",
  poison: "bg-purple-500",
  ground: "bg-yellow-600",
  flying: "bg-indigo-300",
  psychic: "bg-pink-500",
  bug: "bg-lime-500",
  rock: "bg-yellow-700",
  ghost: "bg-purple-700",
  dragon: "bg-indigo-600",
  dark: "bg-gray-700",
  steel: "bg-gray-400",
  fairy: "bg-pink-300",
};

/**
 * ポケモンタイプ名に対応する Tailwind 背景色クラスを返す。
 * @param type ポケモンのタイプ (18 種の PokemonType)。未知の値は backend 境界 (toPokemonType) で排除済み。
 * @returns Tailwind 背景色クラス。
 */
export function getTypeColor(type: PokemonType): string {
  return typeColors[type];
}

/** ポケモンタイプ名から日本語表示名へのマップ。全 18 種を網羅する (Record が網羅性を保証)。 */
const typeLabels: Record<PokemonType, string> = {
  normal: "ノーマル",
  fire: "ほのお",
  water: "みず",
  electric: "でんき",
  grass: "くさ",
  ice: "こおり",
  fighting: "かくとう",
  poison: "どく",
  ground: "じめん",
  flying: "ひこう",
  psychic: "エスパー",
  bug: "むし",
  rock: "いわ",
  ghost: "ゴースト",
  dragon: "ドラゴン",
  dark: "あく",
  steel: "はがね",
  fairy: "フェアリー",
};

/**
 * ポケモンタイプ名に対応する日本語表示名を返す。
 * @param type ポケモンのタイプ (18 種の PokemonType)。未知の値は backend 境界 (toPokemonType) で排除済み。
 * @returns 日本語のタイプ表示名。
 */
export function getTypeLabel(type: PokemonType): string {
  return typeLabels[type];
}
