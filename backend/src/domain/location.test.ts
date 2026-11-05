import { describe, expect } from "vitest";
import {
  QUEST_LOCATIONS,
  findLocation,
  pickRandomLocations,
} from "./location.js";
import type { RandomSource } from "./ports.js";
import type { PokemonType } from "../../../shared/api-types/pokemon.js";
import { defineCase } from "../test/defineCase.js";

function fixedRandom(value: number): RandomSource {
  return { next: () => value };
}

describe("[本体:クエスト]クエストの場所定義", () => {
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

  for (const type of allTypes) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        steps: [
          {
            Given: `定義された場所のうち、${typeLabels[type]}タイプを持つ場所を数えたとき`,
            When: ["場所の定義を参照する"],
            Then: `${typeLabels[type]}タイプを持つ場所はちょうど 2 か所になる`,
          },
        ],
      },
      () => {
        const count = QUEST_LOCATIONS.filter((l) => l.types.includes(type)).length;
        expect(count).toBe(2);
      },
    );
  }
});

describe("[本体:クエスト]場所 ID に対応する場所", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "場所 ID を crystal-cave と指定したとき",
          When: ["場所 ID から場所を探す"],
          Then: "対応する場所の名前はきらめく水晶の洞窟になる",
        },
      ],
    },
    () => {
      expect(findLocation("crystal-cave")?.name).toBe("きらめく水晶の洞窟");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: "どの場所にも無い場所 ID no-such-place を指定したとき",
          When: ["場所 ID から場所を探す"],
          Then: "対応する場所は無しになる",
        },
      ],
    },
    () => {
      expect(findLocation("no-such-place")).toBeUndefined();
    },
  );
});

const PICK_LOCATIONS = "場所を抽選する";

describe("[本体:クエスト]場所の抽選", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: "場所を 4 か所指定したとき", When: [PICK_LOCATIONS], Then: "選ばれる場所の数は 4 か所になる" }],
    },
    () => {
      const picked = pickRandomLocations(fixedRandom(0), 4);
      expect(picked).toHaveLength(4);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: "場所を 4 か所指定したとき", When: [PICK_LOCATIONS], Then: "選ばれた場所に重複は無い" }],
    },
    () => {
      const picked = pickRandomLocations(fixedRandom(0), 4);
      expect(new Set(picked.map((l) => l.id)).size).toBe(4);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: "場所を 0 か所指定したとき", When: [PICK_LOCATIONS], Then: "選ばれる場所の数は 0 か所になる" }],
    },
    () => {
      const picked = pickRandomLocations(fixedRandom(0), 0);
      expect(picked).toHaveLength(0);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: "場所を 1 か所指定したとき", When: [PICK_LOCATIONS], Then: "選ばれる場所の数は 1 か所になる" }],
    },
    () => {
      const picked = pickRandomLocations(fixedRandom(0), 1);
      expect(picked).toHaveLength(1);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "定義された場所の総数と同じ 10 か所を指定したとき",
          When: [PICK_LOCATIONS],
          Then: "選ばれる場所の数は 10 か所になる",
        },
      ],
    },
    () => {
      const picked = pickRandomLocations(fixedRandom(0), 10);
      expect(picked).toHaveLength(10);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "定義された場所の総数 10 か所より 1 か所多い 11 か所を指定したとき",
          When: [PICK_LOCATIONS],
          Then: "選ばれる場所の数は 10 か所になる",
        },
      ],
    },
    () => {
      const picked = pickRandomLocations(fixedRandom(0), 11);
      expect(picked).toHaveLength(10);
    },
  );
});
