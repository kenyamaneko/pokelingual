import { describe, it, expect } from "vitest";
import { getTypeColor, getTypeLabel } from "./pokemonTypes";
import type { PokemonType } from "../../../shared/api-types/pokemon";

const allTypes: PokemonType[] = [
  "normal", "fire", "water", "electric", "grass", "ice",
  "fighting", "poison", "ground", "flying", "psychic", "bug",
  "rock", "ghost", "dragon", "dark", "steel", "fairy",
];

/**
 * getTypeColor は 18 種のタイプを Tailwind 背景色クラスへ対応づける分類関数。
 * 色の割り当てそのものを突き合わせると実装のコピーになるため、UI 仕様上の不変条件
 * 「どのタイプも必ず bg- クラスを返す (= バッジが色を持つ)」を全タイプで確かめる。
 */
describe("getTypeColor (タイプ→Tailwind 背景色クラス)", () => {
  it.each(allTypes)("%s は bg- で始まる背景色クラスを返す", (type) => {
    expect(getTypeColor(type)).toMatch(/^bg-/);
  });
});

/**
 * getTypeLabel は 18 種のタイプを日本語表示名へ対応づける命名関数。
 * 全対応を書き写すと実装の二重管理になるため、不変条件「どのタイプも空でないラベルを
 * 返す」を全タイプで確かめたうえで、命名規則を代表的な具体値で固定する。
 */
describe("getTypeLabel (タイプ→日本語表示名)", () => {
  it.each(allTypes)("%s は空でない日本語ラベルを返す", (type) => {
    expect(getTypeLabel(type)).not.toBe("");
  });

  it("electric は でんき を返す", () => {
    expect(getTypeLabel("electric")).toBe("でんき");
  });

  it("fire は ほのお を返す", () => {
    expect(getTypeLabel("fire")).toBe("ほのお");
  });

  it("psychic は エスパー を返す", () => {
    expect(getTypeLabel("psychic")).toBe("エスパー");
  });
});
