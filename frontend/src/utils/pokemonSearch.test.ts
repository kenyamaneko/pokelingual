import { describe, it, expect } from "vitest";
import { searchPokemonByName } from "./pokemonSearch";

const entries = [
  { name_ja: "アーボック" },
  { name_ja: "アーボ" },
  { name_ja: "アズマオウ" },
  { name_ja: "イーブイ" },
];

/**
 * 苦手ポケモン検索の前方一致仕様。純粋な検索ロジックなので具体値で直接確かめる。
 */
describe("searchPokemonByName", () => {
  it("クエリが空文字なら候補は出ない", () => {
    expect(searchPokemonByName(entries, "")).toEqual([]);
  });

  it("クエリの前方に一致する候補がなければ候補は出ない", () => {
    expect(searchPokemonByName(entries, "ゼッ")).toEqual([]);
  });

  it("1文字のクエリでは、その文字から始まる候補が複数ヒットする", () => {
    expect(searchPokemonByName(entries, "ア").map((e) => e.name_ja)).toEqual([
      "アーボック",
      "アーボ",
      "アズマオウ",
    ]);
  });

  it("一部の文字だけ一致し完全には前方一致しない候補が混ざるとき、完全一致する候補だけが入力順のまま返る", () => {
    expect(searchPokemonByName(entries, "アー").map((e) => e.name_ja)).toEqual([
      "アーボック",
      "アーボ",
    ]);
  });

  it("クエリの文字数を増やすと、一致する候補を1件まで絞り込める", () => {
    expect(searchPokemonByName(entries, "アーボッ").map((e) => e.name_ja)).toEqual([
      "アーボック",
    ]);
  });
});
