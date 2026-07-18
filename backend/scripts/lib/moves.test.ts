import { describe, it, expect } from "vitest";
import {
  resolveLevelUpMoveCandidates,
  resolveMoveNameJA,
  pickHintMoveNames,
  type PokeAPIMoveEntry,
} from "./moves.js";
import type { RandomSource } from "../../src/domain/ports.js";

/** 固定値を返す乱数ソース。 */
function fixedRandom(value: number): RandomSource {
  return { next: () => value };
}

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

describe("[スナップショット生成] レベルアップ技候補の解決", () => {
  it("最優先のバージョングループにレベルアップ技があるとき、レベル昇順で返す", () => {
    const moves = [
      moveEntry("vine-whip", 22, [{ versionGroup: "sword-shield", level: 7 }]),
      moveEntry("tackle", 33, [{ versionGroup: "sword-shield", level: 1 }]),
      moveEntry("growl", 45, [{ versionGroup: "sword-shield", level: 1 }]),
    ];
    expect(resolveLevelUpMoveCandidates(moves)).toEqual([
      { slug: "tackle", id: 33 },
      { slug: "growl", id: 45 },
      { slug: "vine-whip", id: 22 },
    ]);
  });

  it("最優先のバージョングループにレベルアップ技のデータが無いとき、優先順で次のバージョングループにフォールバックする", () => {
    const moves = [
      moveEntry("tackle", 33, [{ versionGroup: "x-y", level: 1 }]),
      moveEntry("growl", 45, [{ versionGroup: "x-y", level: 1 }]),
    ];
    expect(resolveLevelUpMoveCandidates(moves)).toEqual([
      { slug: "tackle", id: 33 },
      { slug: "growl", id: 45 },
    ]);
  });

  it("同じ技を同じバージョングループ内の複数レベルで習得するとき、重複を除いて1件にまとめる", () => {
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

  it("どのバージョングループにもレベルアップ技が無いとき、空配列を返す", () => {
    expect(resolveLevelUpMoveCandidates([])).toEqual([]);
  });
});

describe("[スナップショット生成] 技の日本語名解決", () => {
  it("jaの名称があるとき、その名称を返す", () => {
    const names = [
      { name: "Tackle", language: { name: "en" } },
      { name: "たいあたり", language: { name: "ja" } },
    ];
    expect(resolveMoveNameJA(names)).toBe("たいあたり");
  });

  it("jaが無くja-Hrktがあるとき、ja-Hrktを返す", () => {
    const names = [
      { name: "Tackle", language: { name: "en" } },
      { name: "たいあたり", language: { name: "ja-Hrkt" } },
    ];
    expect(resolveMoveNameJA(names)).toBe("たいあたり");
  });

  it("jaもja-Hrktも無いときエラーになる", () => {
    const names = [{ name: "Tackle", language: { name: "en" } }];
    expect(() => resolveMoveNameJA(names)).toThrow(/no japanese name/);
  });
});

describe("[スナップショット生成] ヒント技のランダム選出", () => {
  const moveNamesJA = new Map([
    ["tackle", "たいあたり"],
    ["growl", "なきごえ"],
    ["vine-whip", "つるのムチ"],
    ["leech-seed", "やどりぎのタネ"],
  ]);

  it("候補が2件のとき、2件とも日本語名で返す", () => {
    const candidates = [
      { slug: "tackle", id: 1 },
      { slug: "growl", id: 2 },
    ];
    const picked = pickHintMoveNames(candidates, moveNamesJA, fixedRandom(0));
    expect(picked).toEqual(["たいあたり", "なきごえ"]);
  });

  it("候補が3件のとき、3件とも日本語名で返す", () => {
    const candidates = [
      { slug: "tackle", id: 1 },
      { slug: "growl", id: 2 },
      { slug: "vine-whip", id: 3 },
    ];
    const picked = pickHintMoveNames(candidates, moveNamesJA, fixedRandom(0));
    expect(picked).toEqual(["たいあたり", "なきごえ", "つるのムチ"]);
  });

  it("候補が4件のとき、3件だけ日本語名で返す", () => {
    const candidates = [
      { slug: "tackle", id: 1 },
      { slug: "growl", id: 2 },
      { slug: "vine-whip", id: 3 },
      { slug: "leech-seed", id: 4 },
    ];
    const picked = pickHintMoveNames(candidates, moveNamesJA, fixedRandom(0));
    expect(picked).toEqual(["たいあたり", "なきごえ", "つるのムチ"]);
  });

  it("候補が0件のとき、空配列を返す", () => {
    expect(pickHintMoveNames([], moveNamesJA, fixedRandom(0))).toEqual([]);
  });

  it("選んだ技の日本語名が解決済みマップに無いときエラーになる", () => {
    const candidates = [{ slug: "unknown-move", id: 999 }];
    expect(() => pickHintMoveNames(candidates, moveNamesJA, fixedRandom(0))).toThrow(
      /no resolved japanese name/,
    );
  });
});
