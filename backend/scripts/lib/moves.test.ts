import { describe, expect } from "vitest";
import { resolveLevelUpMoveCandidates, resolveMoveNameJA, resolveLevelUpMoveNames, type PokeAPIMoveEntry } from "./moves.js";
import { defineCase, type Viewpoint } from "../../src/test/defineCase.js";

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

function convertCandidatesFrom(source: string): string {
  return `${source} PokeAPI の技のデータを、レベルアップで覚える技の候補に変換する`;
}

function convertMoveNameFrom(source: string): string {
  return `${source} PokeAPI の技の名称の一覧を、技の日本語名に変換する`;
}

function convertNameListFrom(candidates: string): string {
  return `技の候補 ${candidates}を、日本語名の一覧に変換する`;
}

describe("[外部連携:ポケモンデータ提供元]レベルアップで覚える技の候補の決定", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["件数・有無"],
      steps: [
        {
          When: [convertCandidatesFrom("ソード・シールドで、vine-whip を Lv.7、tackle を Lv.1、growl を Lv.1 のレベルアップで覚える")],
          Then: "技の候補は、順不同で、tackle・growl・vine-whip の 3 件になる",
        },
      ],
    },
    () => {
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
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["件数・有無"],
      steps: [
        {
          When: [convertCandidatesFrom("ソード・シールドで、sketch だけを Lv.1 のレベルアップで覚える")],
          Then: "技の候補は、sketch の 1 件だけになる",
        },
      ],
    },
    () => {
      const moves = [moveEntry("sketch", 166, [{ versionGroup: "sword-shield", level: 1 }])];
      expect(resolveLevelUpMoveCandidates(moves)).toEqual([{ slug: "sketch", id: 166 }]);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          When: [convertCandidatesFrom("ソード・シールドにレベルアップで覚える技のデータが無く、X・Y で、tackle と growl を Lv.1 のレベルアップで覚える")],
          Then: "技の候補は、順不同で、tackle・growl の 2 件になる",
        },
      ],
    },
    () => {
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
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          When: [convertCandidatesFrom("ソード・シールドで、double-edge を Lv.10 と Lv.30 のレベルアップで覚える")],
          Then: "技の候補は、double-edge の 1 件だけになる",
        },
      ],
    },
    () => {
      const moves = [
        moveEntry("double-edge", 38, [
          { versionGroup: "sword-shield", level: 10 },
          { versionGroup: "sword-shield", level: 30 },
        ]),
      ];
      expect(resolveLevelUpMoveCandidates(moves)).toEqual([{ slug: "double-edge", id: 38 }]);
    },
  );

  const NO_CANDIDATE_CASES: { source: string; moves: PokeAPIMoveEntry[]; 観点: readonly Viewpoint[] }[] = [
    {
      source: "ソード・シールドで、レベルアップ以外の方法でしか覚えない技として、タマゴ技だけがある",
      moves: [moveEntry("egg-move", 99, [{ versionGroup: "sword-shield", level: 0, learnMethod: "egg" }])],
      観点: ["件数・有無"],
    },
    { source: "1 件も無い", moves: [], 観点: ["件数・有無"] },
  ];

  for (const { source, moves, 観点 } of NO_CANDIDATE_CASES) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        観点,
        steps: [{ When: [convertCandidatesFrom(source)], Then: "技の候補は空になる" }],
      },
      () => {
        expect(resolveLevelUpMoveCandidates(moves)).toEqual([]);
      },
    );
  }
});

describe("[外部連携:ポケモンデータ提供元]技の日本語名の決定", () => {
  for (const { source, languageCode } of [
    { source: "英語名 Tackle と通常表記の日本語名「たいあたり」がある", languageCode: "ja" },
    { source: "英語名 Tackle とかな表記の名称「たいあたり」があり、通常表記の日本語名が無い", languageCode: "ja-Hrkt" },
  ]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        steps: [{ When: [convertMoveNameFrom(source)], Then: "技の日本語名は「たいあたり」になる" }],
      },
      () => {
        const names = [
          { name: "Tackle", language: { name: "en" } },
          { name: "たいあたり", language: { name: languageCode } },
        ];
        expect(resolveMoveNameJA(names)).toBe("たいあたり");
      },
    );
  }

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      観点: ["外部依存の失敗"],
      steps: [
        {
          When: [convertMoveNameFrom("英語名 Tackle しか無く、通常表記もかな表記も日本語名が無い")],
          Then: "日本語名が無いことを示すエラーになる",
        },
      ],
    },
    () => {
      const names = [{ name: "Tackle", language: { name: "en" } }];
      expect(() => resolveMoveNameJA(names)).toThrow(/no japanese name/);
    },
  );
});

const moveNamesJA = new Map([
  ["tackle", "たいあたり"],
  ["growl", "なきごえ"],
  ["vine-whip", "つるのムチ"],
  ["leech-seed", "やどりぎのタネ"],
]);

const MOVE_NAMES_RESOLVED_GIVEN =
  "日本語名を調べ終えている技が、tackle はたいあたり・growl はなきごえ・vine-whip はつるのムチ・leech-seed はやどりぎのタネの 4 つのとき";

describe("[外部連携:ポケモンデータ提供元]技の候補の日本語名の一覧の作成", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["件数・有無"],
      steps: [
        {
          Given: MOVE_NAMES_RESOLVED_GIVEN,
          When: [convertNameListFrom("tackle・growl・vine-whip・leech-seed の順の 4 件")],
          Then: "日本語名の一覧は、たいあたり・なきごえ・つるのムチ・やどりぎのタネの順の 4 件になる",
        },
      ],
    },
    () => {
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
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["件数・有無"],
      steps: [
        {
          When: [convertNameListFrom("0 件")],
          Then: "日本語名の一覧は空になる",
        },
      ],
    },
    () => {
      expect(resolveLevelUpMoveNames([], moveNamesJA)).toEqual([]);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: MOVE_NAMES_RESOLVED_GIVEN,
          When: [convertNameListFrom("ember の 1 件")],
          Then: "日本語名を調べ終えていない技があることを示すエラーになる",
        },
      ],
    },
    () => {
      const candidates = [{ slug: "ember", id: 999 }];
      expect(() => resolveLevelUpMoveNames(candidates, moveNamesJA)).toThrow(
        /no resolved japanese name/,
      );
    },
  );
});
