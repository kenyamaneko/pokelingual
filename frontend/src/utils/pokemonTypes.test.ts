import { describe, it, expect } from "vitest";
import { getTypeColor, getTypeLabel } from "./pokemonTypes";
import type { PokemonType } from "../../../shared/api-types/pokemon";

const allTypes: PokemonType[] = [
  "normal", "fire", "water", "electric", "grass", "ice",
  "fighting", "poison", "ground", "flying", "psychic", "bug",
  "rock", "ghost", "dragon", "dark", "steel", "fairy",
];

describe("[タイプ] タイプの表示色", () => {
  describe("正常系", () => {
    it.each(allTypes)("タイプが %s のとき、背景色が割り当てられる", (type) => {
      expect(getTypeColor(type)).toMatch(/^bg-/);
    });
  });
});

describe("[タイプ] タイプの表示名", () => {
  describe("正常系", () => {
    it.each(allTypes)("タイプが %s のとき、表示名が空文字ではない", (type) => {
      expect(getTypeLabel(type)).not.toBe("");
    });

    it("タイプが electric のとき、表示名は「でんき」になる", () => {
      expect(getTypeLabel("electric")).toBe("でんき");
    });

    it("タイプが fire のとき、表示名は「ほのお」になる", () => {
      expect(getTypeLabel("fire")).toBe("ほのお");
    });

    it("タイプが psychic のとき、表示名は「エスパー」になる", () => {
      expect(getTypeLabel("psychic")).toBe("エスパー");
    });
  });
});
