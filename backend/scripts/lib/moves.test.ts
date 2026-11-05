import { describe, expect } from "vitest";
import { resolveLevelUpMoveCandidates, resolveMoveNameJA, resolveLevelUpMoveNames, type PokeAPIMoveEntry } from "./moves.js";
import { defineCase } from "../../src/test/defineCase.js";

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

const DETERMINE_CANDIDATES = "ポケモンデータのスナップショット生成で、ポケモンの技のデータから、レベルアップで覚える技の候補を決定する";
const DETERMINE_MOVE_NAME = "ポケモンデータのスナップショット生成で、技の名称の一覧から、技の日本語名を決定する";
const CREATE_NAME_LIST = "ポケモンデータのスナップショット生成で、技の候補の日本語名の一覧を作成する";

describe("[外部連携:ポケモンデータ提供元]レベルアップで覚える技の候補の決定", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "ソード・シールドでレベルアップで覚える技が vine-whip (技の番号 22・Lv.7)・tackle (33・Lv.1)・growl (45・Lv.1) の 3 つあるとき",
          When: [DETERMINE_CANDIDATES],
          Then: "技の候補は、tackle (技の番号 33)・growl (45)・vine-whip (22) の 3 件になる (並びは問わない)",
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
      steps: [
        {
          Given: "ソード・シールドでレベルアップで覚える技が sketch (技の番号 166・Lv.1) の 1 つだけのとき",
          When: [DETERMINE_CANDIDATES],
          Then: "技の候補は sketch (技の番号 166) の 1 件だけになる",
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
          Given: "ソード・シールドにレベルアップで覚える技のデータが無く、X・Y に tackle (技の番号 33・Lv.1) と growl (45・Lv.1) があるとき",
          When: [DETERMINE_CANDIDATES],
          Then: "技の候補は tackle (33) と growl (45) の 2 件になる (並びは問わない)",
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
          Given: "ソード・シールドで double-edge (技の番号 38) を Lv.10 と Lv.30 の 2 つのレベルで覚えるとき",
          When: [DETERMINE_CANDIDATES],
          Then: "技の候補は double-edge (技の番号 38) の 1 件だけになる",
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

  for (const { given, moves } of [
    {
      given: "ソード・シールドで、タマゴ技 (egg-move・技の番号 99) のようにレベルアップ以外の方法でしか覚えない技だけがあるとき",
      moves: [moveEntry("egg-move", 99, [{ versionGroup: "sword-shield", level: 0, learnMethod: "egg" }])],
    },
    { given: "技のデータが 1 件も無いとき", moves: [] },
  ]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        steps: [{ Given: given, When: [DETERMINE_CANDIDATES], Then: "技の候補は空になる" }],
      },
      () => {
        expect(resolveLevelUpMoveCandidates(moves)).toEqual([]);
      },
    );
  }
});

describe("[外部連携:ポケモンデータ提供元]技の日本語名の決定", () => {
  for (const { given, languageCode } of [
    { given: "技の名称に通常表記の日本語名「たいあたり」があるとき", languageCode: "ja" },
    { given: "通常表記の日本語名が無く、かな表記の名称「たいあたり」があるとき", languageCode: "ja-Hrkt" },
  ]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        steps: [{ Given: given, When: [DETERMINE_MOVE_NAME], Then: "技の日本語名は「たいあたり」になる" }],
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
      steps: [
        {
          Given: "技の名称に英語名 Tackle しか無く、通常表記もかな表記も日本語名が無いとき",
          When: [DETERMINE_MOVE_NAME],
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
  "日本語名を調べ終えている技が、tackle (たいあたり)・growl (なきごえ)・vine-whip (つるのムチ)・leech-seed (やどりぎのタネ) の 4 つで";

describe("[外部連携:ポケモンデータ提供元]技の候補の日本語名の一覧の作成", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: `${MOVE_NAMES_RESOLVED_GIVEN}、技の候補が tackle・growl・vine-whip・leech-seed の順で 4 件あるとき`,
          When: [CREATE_NAME_LIST],
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
      steps: [
        {
          Given: `${MOVE_NAMES_RESOLVED_GIVEN}、技の候補が 0 件のとき`,
          When: [CREATE_NAME_LIST],
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
          Given: `${MOVE_NAMES_RESOLVED_GIVEN}、技の候補に、日本語名を調べ終えていない技 (unknown-move) があるとき`,
          When: [CREATE_NAME_LIST],
          Then: "日本語名が解決されていないことを示すエラーになる",
        },
      ],
    },
    () => {
      const candidates = [{ slug: "unknown-move", id: 999 }];
      expect(() => resolveLevelUpMoveNames(candidates, moveNamesJA)).toThrow(
        /no resolved japanese name/,
      );
    },
  );
});
