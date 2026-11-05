import { describe, expect } from "vitest";
import { getTypeColor, getTypeLabel } from "./pokemonTypes";
import type { PokemonType } from "../../../shared/api-types/pokemon";
import { defineCase } from "../test/defineCase";

const allTypes: PokemonType[] = [
  "normal", "fire", "water", "electric", "grass", "ice",
  "fighting", "poison", "ground", "flying", "psychic", "bug",
  "rock", "ghost", "dragon", "dark", "steel", "fairy",
];

describe("[本体:ポケモンデータ]タイプの表示色", () => {
  for (const type of allTypes) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        steps: [
          {
            Given: `タイプが ${type} のとき`,
            When: ["タイプの表示色を取得する"],
            Then: "背景色として「bg-」で始まる値が返る",
          },
        ],
      },
      () => {
        expect(getTypeColor(type)).toMatch(/^bg-/);
      },
    );
  }
});

describe("[本体:ポケモンデータ]タイプの表示名", () => {
  for (const type of allTypes) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        steps: [
          {
            Given: `タイプが ${type} のとき`,
            When: ["タイプの表示名を取得する"],
            Then: "表示名は空文字ではない",
          },
        ],
      },
      () => {
        expect(getTypeLabel(type)).not.toBe("");
      },
    );
  }

  for (const { type, label } of [
    { type: "electric", label: "でんき" },
    { type: "fire", label: "ほのお" },
    { type: "psychic", label: "エスパー" },
  ] as const) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        steps: [
          {
            Given: `タイプが ${type} のとき`,
            When: ["タイプの表示名を取得する"],
            Then: `表示名は「${label}」になる`,
          },
        ],
      },
      () => {
        expect(getTypeLabel(type)).toBe(label);
      },
    );
  }
});
