import { describe, it, expect } from "vitest";
import {
  formatPokemonId,
  formatHeightMeters,
  formatWeightKilograms,
} from "./pokemonFormat";

/**
 * 図鑑表示用の整形仕様。表示整形の純関数なので具体値で直接確かめる。
 */
describe("[表示整形] 図鑑番号の表示形式 (3 桁 0 埋め)", () => {
  it.each([
    [1, "001"],
    [25, "025"],
    [150, "150"],
    [999, "999"],
    // 4 桁はパディング不要でそのまま
    [1000, "1000"],
  ])("図鑑番号 %i は %s と表示される", (id, expected) => {
    expect(formatPokemonId(id)).toBe(expected);
  });
});

describe("[表示整形] 高さの表示形式 (メートル)", () => {
  it.each([
    [4, "0.4"],
    [10, "1.0"],
    [20, "2.0"],
  ])("高さ %i デシメートルは %s m と表示される", (dm, expected) => {
    expect(formatHeightMeters(dm)).toBe(expected);
  });
});

describe("[表示整形] 重さの表示形式 (キログラム)", () => {
  it.each([
    [60, "6.0"],
    [5, "0.5"],
    [1220, "122.0"],
  ])("重さ %i ヘクトグラムは %s kg と表示される", (hg, expected) => {
    expect(formatWeightKilograms(hg)).toBe(expected);
  });
});
