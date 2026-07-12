import { describe, it, expect } from "vitest";
import {
  QUEST_LOCATIONS,
  LOCATION_CHOICE_COUNT,
  findLocation,
  pickRandomLocations,
} from "./location.js";
import type { RandomSource } from "./ports.js";
import type { PokemonType } from "../../../shared/api-types/pokemon.js";

/** 固定値を返す乱数ソース。 */
function fixedRandom(value: number): RandomSource {
  return { next: () => value };
}

/**
 * 場所の設計上の不変条件: 全18タイプがそれぞれちょうど2か所に登場する。
 */
describe("クエストの場所定義", () => {
  const allTypes: PokemonType[] = [
    "normal", "fire", "water", "electric", "grass", "ice",
    "fighting", "poison", "ground", "flying", "psychic", "bug",
    "rock", "ghost", "dragon", "dark", "steel", "fairy",
  ];
  const typeLabels: Record<PokemonType, string> = {
    normal: "ノーマル", fire: "ほのお", water: "みず", electric: "でんき", grass: "くさ",
    ice: "こおり", fighting: "かくとう", poison: "どく", ground: "じめん", flying: "ひこう",
    psychic: "エスパー", bug: "むし", rock: "いわ", ghost: "ゴースト", dragon: "ドラゴン",
    dark: "あく", steel: "はがね", fairy: "フェアリー",
  };

  it.each(allTypes.map((type) => [type, typeLabels[type]] as const))(
    "%s (%s) タイプはちょうど2か所に登場する",
    (type) => {
      const count = QUEST_LOCATIONS.filter((l) => l.types.includes(type)).length;
      expect(count).toBe(2);
    },
  );
});

describe("場所の取得 (ID 指定)", () => {
  it("存在する ID の場所を返す", () => {
    expect(findLocation("crystal-cave")?.name).toBe("きらめく水晶の洞窟");
  });

  it("存在しない ID なら undefined を返す", () => {
    expect(findLocation("no-such-place")).toBeUndefined();
  });
});

describe("場所の抽選", () => {
  it("指定した数だけ重複なく場所を返す", () => {
    const picked = pickRandomLocations(fixedRandom(0), LOCATION_CHOICE_COUNT);
    expect(picked).toHaveLength(LOCATION_CHOICE_COUNT);
    expect(new Set(picked.map((l) => l.id)).size).toBe(LOCATION_CHOICE_COUNT);
  });

  it("場所総数より多く要求しても総数までしか返さない", () => {
    const picked = pickRandomLocations(fixedRandom(0), QUEST_LOCATIONS.length + 5);
    expect(picked).toHaveLength(QUEST_LOCATIONS.length);
  });
});
