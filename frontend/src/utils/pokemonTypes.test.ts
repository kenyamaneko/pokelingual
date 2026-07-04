import { describe, it, expect } from "vitest";
import { getTypeColor } from "./pokemonTypes";
import type { PokemonType } from "../../../shared/api-types/pokemon";

/**
 * getTypeColor は 18 種のタイプを Tailwind 背景色クラスへ対応づける分類関数。
 * 色の割り当てそのものを突き合わせると実装のコピーになるため、UI 仕様上の不変条件
 * 「どのタイプも必ず bg- クラスを返す (= バッジが色を持つ)」を全タイプで確かめる。
 */
describe("getTypeColor (タイプ→Tailwind 背景色クラス)", () => {
  const allTypes: PokemonType[] = [
    "normal", "fire", "water", "electric", "grass", "ice",
    "fighting", "poison", "ground", "flying", "psychic", "bug",
    "rock", "ghost", "dragon", "dark", "steel", "fairy",
  ];

  it.each(allTypes)("%s は bg- で始まる背景色クラスを返す", (type) => {
    expect(getTypeColor(type)).toMatch(/^bg-/);
  });
});
