import { describe, it, expect } from "vitest";
import {
  formatPokemonId,
  formatHeightMeters,
  formatWeightKilograms,
} from "./pokemonFormat";

/**
 * 表示整形の純関数。命名規則系のロジックなので具体値で直接確かめる。
 */
describe("formatPokemonId", () => {
  it.each([
    { id: 1, expected: "001" },
    { id: 25, expected: "025" },
    { id: 150, expected: "150" },
    { id: 999, expected: "999" },
    // 4 桁はパディング不要でそのまま
    { id: 1000, expected: "1000" },
  ])("$id → $expected", ({ id, expected }) => {
    expect(formatPokemonId(id)).toBe(expected);
  });
});

describe("formatHeightMeters", () => {
  it.each([
    { dm: 4, expected: "0.4" },
    { dm: 10, expected: "1.0" },
    { dm: 20, expected: "2.0" },
  ])("$dm dm → $expected m", ({ dm, expected }) => {
    expect(formatHeightMeters(dm)).toBe(expected);
  });
});

describe("formatWeightKilograms", () => {
  it.each([
    { hg: 60, expected: "6.0" },
    { hg: 5, expected: "0.5" },
    { hg: 1220, expected: "122.0" },
  ])("$hg hg → $expected kg", ({ hg, expected }) => {
    expect(formatWeightKilograms(hg)).toBe(expected);
  });
});
