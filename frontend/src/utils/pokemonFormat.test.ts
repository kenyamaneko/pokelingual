import { describe, it, expect } from "vitest";
import {
  formatPokemonId,
  formatHeightMeters,
  formatWeightKilograms,
} from "./pokemonFormat";

/**
 * 図鑑表示用の整形仕様。表示整形の純関数なので具体値で直接確かめる。
 */
describe("formatPokemonId (図鑑番号の 3 桁 0 埋め)", () => {
  it.each([
    { id: 1, expected: "001" },
    { id: 25, expected: "025" },
    { id: 150, expected: "150" },
    { id: 999, expected: "999" },
    // 4 桁はパディング不要でそのまま
    { id: 1000, expected: "1000" },
  ])("図鑑番号 $id は $expected と表示される", ({ id, expected }) => {
    expect(formatPokemonId(id)).toBe(expected);
  });
});

describe("formatHeightMeters (PokeAPI のデシメートルをメートル表示に変換)", () => {
  it.each([
    { dm: 4, expected: "0.4" },
    { dm: 10, expected: "1.0" },
    { dm: 20, expected: "2.0" },
  ])("高さ $dm デシメートルは $expected m と表示される", ({ dm, expected }) => {
    expect(formatHeightMeters(dm)).toBe(expected);
  });
});

describe("formatWeightKilograms (PokeAPI のヘクトグラムをキログラム表示に変換)", () => {
  it.each([
    { hg: 60, expected: "6.0" },
    { hg: 5, expected: "0.5" },
    { hg: 1220, expected: "122.0" },
  ])("重さ $hg ヘクトグラムは $expected kg と表示される", ({ hg, expected }) => {
    expect(formatWeightKilograms(hg)).toBe(expected);
  });
});
