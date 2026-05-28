/** ポケモンタイプ名から Tailwind 背景色クラスへのマップ。18種全てを網羅する想定。 */
const typeColors: Record<string, string> = {
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
 * 未知のタイプ名は本来発生しないため、検出時は console.error でアラート。
 * 表示崩れを避けるためフォールバック色は返すが、これは "想定しないが UI を守る" 用途。
 */
export function getTypeColor(type: string): string {
  const color = typeColors[type];
  if (!color) {
    console.error("unknown pokemon type encountered", type);
    return "bg-gray-400";
  }
  return color;
}
