import { describe, it, expect } from "vitest";
import { resolveLevelUpMoveCandidates, resolveMoveNameJA, resolveLevelUpMoveNames, type PokeAPIMoveEntry } from "./moves.js";

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

describe("[ポケモンデータ] レベルアップで覚える技の候補の決定", () => {
  describe("正常系", () => {
    it("ソード・シールドでレベルアップで覚える技が 3 つあるとき、その 3 つがすべて候補になる", () => {
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

    it("ソード・シールドでレベルアップで覚える技が 1 つだけのとき、その 1 つだけが候補になる", () => {
      const moves = [moveEntry("sketch", 166, [{ versionGroup: "sword-shield", level: 1 }])];
      expect(resolveLevelUpMoveCandidates(moves)).toEqual([{ slug: "sketch", id: 166 }]);
    });

    it("ソード・シールドにレベルアップで覚える技のデータが無く X・Y にだけあるとき、X・Y でレベルアップで覚える技が候補になる", () => {
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

    it("ソード・シールドで同じ技を 2 つの異なるレベルで覚えるとき、その技は候補に 1 件だけ入る", () => {
      const moves = [
        moveEntry("double-edge", 38, [
          { versionGroup: "sword-shield", level: 10 },
          { versionGroup: "sword-shield", level: 30 },
        ]),
      ];
      expect(resolveLevelUpMoveCandidates(moves)).toEqual([{ slug: "double-edge", id: 38 }]);
    });

    it.each([
      [
        "タマゴ技など、レベルアップ以外の方法でしか覚えない技だけの",
        [moveEntry("egg-move", 99, [{ versionGroup: "sword-shield", level: 0, learnMethod: "egg" }])],
      ],
      ["技のデータが 1 件も無い", []],
    ])("%sとき、候補は空になる", (_label, moves) => {
      expect(resolveLevelUpMoveCandidates(moves)).toEqual([]);
    });
  });
});

describe("[ポケモンデータ] 技の日本語名の決定", () => {
  describe("正常系", () => {
    it("技の名称に通常表記の日本語名があるとき、決定した日本語名は通常表記の名称になる", () => {
      const names = [
        { name: "Tackle", language: { name: "en" } },
        { name: "たいあたり", language: { name: "ja" } },
      ];
      expect(resolveMoveNameJA(names)).toBe("たいあたり");
    });

    it("通常表記の日本語名が無くかな表記の名称があるとき、決定した日本語名はかな表記の名称になる", () => {
      const names = [
        { name: "Tackle", language: { name: "en" } },
        { name: "たいあたり", language: { name: "ja-Hrkt" } },
      ];
      expect(resolveMoveNameJA(names)).toBe("たいあたり");
    });
  });

  describe("異常系", () => {
    it("通常表記もかな表記も日本語名が無いとき、決定すると日本語名が無いというエラーになる", () => {
      const names = [{ name: "Tackle", language: { name: "en" } }];
      expect(() => resolveMoveNameJA(names)).toThrow(/no japanese name/);
    });
  });
});

describe("[ポケモンデータ] 技の候補の日本語名への変換", () => {
  const moveNamesJA = new Map([
    ["tackle", "たいあたり"],
    ["growl", "なきごえ"],
    ["vine-whip", "つるのムチ"],
    ["leech-seed", "やどりぎのタネ"],
  ]);

  describe("正常系", () => {
    it("候補の技すべてに日本語名があるとき、日本語名の一覧は候補と同じ件数・同じ順序になる", () => {
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

    it("候補が 0 件のとき、日本語名の一覧は空になる", () => {
      expect(resolveLevelUpMoveNames([], moveNamesJA)).toEqual([]);
    });
  });

  describe("異常系", () => {
    it("日本語名を調べ終えていない技が候補にあるとき、変換すると日本語名が解決されていないというエラーになる", () => {
      const candidates = [{ slug: "unknown-move", id: 999 }];
      expect(() => resolveLevelUpMoveNames(candidates, moveNamesJA)).toThrow(
        /no resolved japanese name/,
      );
    });
  });
});
