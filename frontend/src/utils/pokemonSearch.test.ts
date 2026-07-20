import { describe, it, expect } from "vitest";
import { searchPokemonByName } from "./pokemonSearch";

// 五十音順への並べ替えを検証できるよう、あえて五十音順ではない順で並べる。
const entries = [
  { name_ja: "アズマオウ" },
  { name_ja: "アーボック" },
  { name_ja: "イーブイ" },
  { name_ja: "アーボ" },
];

/**
 * 苦手ポケモン検索の前方一致仕様。純粋な検索ロジックなので具体値で直接確かめる。
 */
describe("[設定] ポケモン名の検索", () => {
  it("クエリが空文字なら候補は出ない", () => {
    expect(searchPokemonByName(entries, "")).toEqual([]);
  });

  it("クエリの前方に一致する候補がなければ候補は出ない", () => {
    expect(searchPokemonByName(entries, "ゼッ")).toEqual([]);
  });

  it("1文字のクエリでは、その文字から始まる候補が五十音順に並んで複数ヒットする", () => {
    expect(searchPokemonByName(entries, "ア").map((e) => e.name_ja)).toEqual([
      "アーボ",
      "アーボック",
      "アズマオウ",
    ]);
  });

  it("一部の文字だけ一致し完全には前方一致しない候補が混ざるとき、完全一致する候補だけが五十音順に並んでヒットする", () => {
    expect(searchPokemonByName(entries, "アー").map((e) => e.name_ja)).toEqual([
      "アーボ",
      "アーボック",
    ]);
  });

  it("クエリの文字数を増やすと、一致する候補を1件まで絞り込める", () => {
    expect(searchPokemonByName(entries, "アーボッ").map((e) => e.name_ja)).toEqual([
      "アーボック",
    ]);
  });

  it("ひらがなのクエリは、対応するカタカナ名の前方一致としてヒットする", () => {
    expect(searchPokemonByName(entries, "あーぼ").map((e) => e.name_ja)).toEqual([
      "アーボ",
      "アーボック",
    ]);
  });
});
