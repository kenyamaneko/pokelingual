import { describe, it, expect } from "vitest";
import { resolveLevelUpMoveCandidates, resolveMoveNameJA, resolveLevelUpMoveNames, type PokeAPIMoveEntry } from "./moves.js";

/**
 * 技1件分の pokemon.moves エントリを作る。
 * @param slug 技スラッグ。
 * @param id PokeAPI 上の技 ID。
 * @param details 習得方法・バージョングループの一覧。
 * @returns pokemon.moves の1要素。
 */
function moveEntry(
  slug: string,
  id: number,
  details: { versionGroup: string; level: number; learnMethod?: string }[],
): PokeAPIMoveEntry {
  return {
    move: { name: slug, url: `https://pokeapi.co/api/v2/move/${id}/` },
    version_group_details: details.map((d) => ({
      level_learned_at: d.level,
      move_learn_method: { name: d.learnMethod ?? "level-up" },
      version_group: { name: d.versionGroup },
    })),
  };
}

describe("[ポケモンデータ] レベルアップ技候補の決定", () => {
  it("優先度が最も高い作品にレベルアップ技があるとき、それらを候補にする", () => {
    const moves = [
      moveEntry("vine-whip", 22, [{ versionGroup: "sword-shield", level: 7 }]),
      moveEntry("tackle", 33, [{ versionGroup: "sword-shield", level: 1 }]),
      moveEntry("growl", 45, [{ versionGroup: "sword-shield", level: 1 }]),
    ];
    const candidates = resolveLevelUpMoveCandidates(moves);
    expect(candidates).toHaveLength(3);
    expect(candidates).toEqual(
      expect.arrayContaining([
        { slug: "tackle", id: 33 },
        { slug: "growl", id: 45 },
        { slug: "vine-whip", id: 22 },
      ]),
    );
  });

  it("優先度が最も高い作品のレベルアップ技候補が1件だけのとき、その1件を返す", () => {
    const moves = [moveEntry("sketch", 166, [{ versionGroup: "sword-shield", level: 1 }])];
    expect(resolveLevelUpMoveCandidates(moves)).toEqual([{ slug: "sketch", id: 166 }]);
  });

  it("優先度が最も高い作品にレベルアップ技のデータが無いとき、優先順で次の作品のレベルアップ技を候補にする", () => {
    const moves = [
      moveEntry("tackle", 33, [{ versionGroup: "x-y", level: 1 }]),
      moveEntry("growl", 45, [{ versionGroup: "x-y", level: 1 }]),
    ];
    const candidates = resolveLevelUpMoveCandidates(moves);
    expect(candidates).toHaveLength(2);
    expect(candidates).toEqual(
      expect.arrayContaining([
        { slug: "tackle", id: 33 },
        { slug: "growl", id: 45 },
      ]),
    );
  });

  it("優先度が最も高い作品で同じ技を複数レベルで習得できるとき、重複を除いて1件にまとめる", () => {
    const moves = [
      moveEntry("double-edge", 38, [
        { versionGroup: "sword-shield", level: 10 },
        { versionGroup: "sword-shield", level: 30 },
      ]),
    ];
    expect(resolveLevelUpMoveCandidates(moves)).toEqual([{ slug: "double-edge", id: 38 }]);
  });

  it("レベルアップ以外の習得方法しか無いとき、その技は候補に含めない", () => {
    const moves = [
      moveEntry("egg-move", 99, [{ versionGroup: "sword-shield", level: 0, learnMethod: "egg" }]),
    ];
    expect(resolveLevelUpMoveCandidates(moves)).toEqual([]);
  });

  it("レベルアップ技のデータがどの作品にも無いとき、空配列を返す", () => {
    expect(resolveLevelUpMoveCandidates([])).toEqual([]);
  });
});

describe("[ポケモンデータ] 技の日本語名の決定", () => {
  it("通常表記の日本語名があるとき、その名称を返す", () => {
    const names = [
      { name: "Tackle", language: { name: "en" } },
      { name: "たいあたり", language: { name: "ja" } },
    ];
    expect(resolveMoveNameJA(names)).toBe("たいあたり");
  });

  it("通常表記の日本語名が無ければ、かな表記の名称を使う", () => {
    const names = [
      { name: "Tackle", language: { name: "en" } },
      { name: "たいあたり", language: { name: "ja-Hrkt" } },
    ];
    expect(resolveMoveNameJA(names)).toBe("たいあたり");
  });

  it("通常表記もかな表記も無いときエラーになる", () => {
    const names = [{ name: "Tackle", language: { name: "en" } }];
    expect(() => resolveMoveNameJA(names)).toThrow(/no japanese name/);
  });
});

describe("[ポケモンデータ] 技候補の日本語名への変換", () => {
  const moveNamesJA = new Map([
    ["tackle", "たいあたり"],
    ["growl", "なきごえ"],
    ["vine-whip", "つるのムチ"],
    ["leech-seed", "やどりぎのタネ"],
  ]);

  it("候補の技すべてに日本語名があるとき、候補と同じ件数・順序で日本語名の一覧を返す", () => {
    const candidates = [
      { slug: "tackle", id: 1 },
      { slug: "growl", id: 2 },
      { slug: "vine-whip", id: 3 },
      { slug: "leech-seed", id: 4 },
    ];
    expect(resolveLevelUpMoveNames(candidates, moveNamesJA)).toEqual([
      "たいあたり",
      "なきごえ",
      "つるのムチ",
      "やどりぎのタネ",
    ]);
  });

  it("候補が0件のとき、空配列を返す", () => {
    expect(resolveLevelUpMoveNames([], moveNamesJA)).toEqual([]);
  });

  it("候補の技の日本語名が無いときエラーになる", () => {
    const candidates = [{ slug: "unknown-move", id: 999 }];
    expect(() => resolveLevelUpMoveNames(candidates, moveNamesJA)).toThrow(
      /no resolved japanese name/,
    );
  });
});
