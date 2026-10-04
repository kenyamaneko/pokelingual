import { describe, it, expect } from "vitest";
import {
  QUEST_LOCATIONS,
  findLocation,
  pickRandomLocations,
} from "./location.js";
import type { RandomSource } from "./ports.js";
import type { PokemonType } from "../../../shared/api-types/pokemon.js";

function fixedRandom(value: number): RandomSource {
  return { next: () => value };
}

describe("[出題] クエストの場所定義", () => {
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

  describe("正常系", () => {
    it.each(allTypes.map((type) => [typeLabels[type], type] as const))(
      "定義された場所のうち、%sタイプを持つ場所はちょうど 2 か所になる",
      (_label, type) => {
        const count = QUEST_LOCATIONS.filter((l) => l.types.includes(type)).length;
        expect(count).toBe(2);
      },
    );
  });
});

describe("[出題] 場所の ID による取得", () => {
  describe("正常系", () => {
    it("きらめく水晶の洞窟の場所 ID を指定したとき、取得した場所の名前はきらめく水晶の洞窟になる", () => {
      expect(findLocation("crystal-cave")?.name).toBe("きらめく水晶の洞窟");
    });
  });

  describe("異常系", () => {
    it("どの場所にも無い ID を指定したとき、場所の取得結果は無しになる", () => {
      expect(findLocation("no-such-place")).toBeUndefined();
    });
  });
});

describe("[出題] 場所の抽選", () => {
  describe("正常系", () => {
    it("場所の総数以下の数を指定したとき、選ばれる場所の数は指定した数になる", () => {
      const requestedCount = 4;
      const picked = pickRandomLocations(fixedRandom(0), requestedCount);
      expect(picked).toHaveLength(requestedCount);
    });

    it("場所の総数以下の数を指定したとき、選ばれた場所に重複は無い", () => {
      const requestedCount = 4;
      const picked = pickRandomLocations(fixedRandom(0), requestedCount);
      expect(new Set(picked.map((l) => l.id)).size).toBe(requestedCount);
    });

    it("場所の総数より多い数を指定したとき、選ばれる場所の数は場所の総数になる", () => {
      const picked = pickRandomLocations(fixedRandom(0), 15);
      expect(picked).toHaveLength(10);
    });
  });
});
