import { describe, it, expect } from "vitest";
import { searchPokemonByName } from "./pokemonSearch";

const entries = [
  { name_ja: "アーボ" },
  { name_ja: "アーボック" },
  { name_ja: "アズマオウ" },
  { name_ja: "イーブイ" },
];

/**
 * 苦手ポケモン検索の前方一致仕様。純粋な検索・並び替えロジックなので具体値で直接確かめる。
 */
describe("searchPokemonByName", () => {
  it("クエリが空文字なら候補は出ない", () => {
    expect(searchPokemonByName(entries, "")).toEqual([]);
  });

  it("先頭が一致しない候補はヒットしない", () => {
    expect(searchPokemonByName(entries, "ア").map((e) => e.name_ja)).not.toContain("イーブイ");
  });

  it("1文字のクエリでは、その文字から始まる候補が (複数あれば全件) ヒットする", () => {
    expect(searchPokemonByName(entries, "ア").map((e) => e.name_ja)).toEqual([
      "アーボ",
      "アーボック",
      "アズマオウ",
    ]);
  });

  it("2文字のクエリでは、完全に前方一致する候補が1文字だけ一致する候補より上位に並ぶ", () => {
    expect(searchPokemonByName(entries, "アー").map((e) => e.name_ja)).toEqual([
      "アーボ",
      "アーボック",
      "アズマオウ",
    ]);
  });
});
