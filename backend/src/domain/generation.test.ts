import { describe, it, expect } from "vitest";
import {
  generationsToPokemonIDs,
  buildQuestPoolIDs,
  validateEnabledGenerations,
} from "./generation.js";

describe("[本体:出題]選択世代に含まれる図鑑番号", () => {
  describe("単体テスト", () => {
    describe("正常系", () => {
      it.each([
        { generation: 1, id: 1 },
        { generation: 1, id: 151 },
        { generation: 2, id: 152 },
        { generation: 2, id: 251 },
        { generation: 3, id: 252 },
        { generation: 3, id: 386 },
        { generation: 4, id: 387 },
        { generation: 4, id: 493 },
        { generation: 5, id: 494 },
        { generation: 5, id: 649 },
        { generation: 6, id: 650 },
        { generation: 6, id: 721 },
        { generation: 7, id: 722 },
        { generation: 7, id: 809 },
        { generation: 8, id: 810 },
        { generation: 8, id: 898 },
      ])("第$generation世代のみを選択したとき、図鑑番号 $id を含む", ({ generation, id }) => {
        expect(generationsToPokemonIDs([generation]).has(id)).toBe(true);
      });

      it.each([
        { generation: 1, id: 0 },
        { generation: 1, id: 152 },
        { generation: 2, id: 151 },
        { generation: 2, id: 252 },
        { generation: 3, id: 251 },
        { generation: 3, id: 387 },
        { generation: 4, id: 386 },
        { generation: 4, id: 494 },
        { generation: 5, id: 493 },
        { generation: 5, id: 650 },
        { generation: 6, id: 649 },
        { generation: 6, id: 722 },
        { generation: 7, id: 721 },
        { generation: 7, id: 810 },
        { generation: 8, id: 809 },
        { generation: 8, id: 899 },
      ])("第$generation世代のみを選択したとき、図鑑番号 $id を含まない", ({ generation, id }) => {
        expect(generationsToPokemonIDs([generation]).has(id)).toBe(false);
      });

      it("第1世代のみを選択したとき、図鑑番号は 151 件になる", () => {
        expect(generationsToPokemonIDs([1]).size).toBe(151);
      });

      it("第2世代と第4世代を選択したとき、図鑑番号は 207 件になる", () => {
        expect(generationsToPokemonIDs([2, 4]).size).toBe(207);
      });

      it.each([251, 387])("第2世代と第4世代を選択したとき、図鑑番号 %i を含む", (id) => {
        expect(generationsToPokemonIDs([2, 4]).has(id)).toBe(true);
      });

      it.each([252, 386])("第2世代と第4世代を選択したとき、選択していない第3世代の図鑑番号 %i を含まない", (id) => {
        expect(generationsToPokemonIDs([2, 4]).has(id)).toBe(false);
      });
    });

    describe("異常系", () => {
      it("世代を 1 つも選択していないとき、図鑑番号は 0 件になる", () => {
        expect(generationsToPokemonIDs([]).size).toBe(0);
      });
    });
  });
});

describe("[本体:出題]出題プールの図鑑番号", () => {
  describe("第1世代を選択し、図鑑番号 5 と 10 を除外したとき", () => {
    const pool = buildQuestPoolIDs([1], new Set([5, 10]));

    describe("単体テスト", () => {
      describe("正常系", () => {
        it("出題プールは 149 件になる", () => {
          expect(pool.size).toBe(149);
        });

        it("除外した図鑑番号 5 と 10 は出題プールに含まれない", () => {
          expect(pool.has(5)).toBe(false);
          expect(pool.has(10)).toBe(false);
        });

        it("除外していない図鑑番号 1 は出題プールに含まれる", () => {
          expect(pool.has(1)).toBe(true);
        });
      });
    });
  });

  describe("単体テスト", () => {
    describe("正常系", () => {
      it("第1世代を選択し、除外した図鑑番号が 0 件のとき、出題プールは 151 件になる", () => {
        const pool = buildQuestPoolIDs([1], new Set());
        expect(pool.size).toBe(151);
      });

      it("第1世代を選択し、第1世代の図鑑番号 5 だけを除外したとき、出題プールは 150 件になる", () => {
        const pool = buildQuestPoolIDs([1], new Set([5]));
        expect(pool.size).toBe(150);
      });

      it("第1世代を選択し、第1世代の外にある図鑑番号 200 を除外したとき、出題プールは 151 件になる", () => {
        const pool = buildQuestPoolIDs([1], new Set([200]));
        expect(pool.size).toBe(151);
      });
    });

    describe("異常系", () => {
      it("第1世代を選択し、第1世代の 151 件の図鑑番号をすべて除外したとき、出題プールは空になる", () => {
        const allGen1 = new Set(Array.from({ length: 151 }, (_, i) => i + 1));
        const pool = buildQuestPoolIDs([1], allGen1);
        expect(pool.size).toBe(0);
      });
    });
  });
});

describe("[本体:設定]出題世代設定の検証", () => {
  describe("単体テスト", () => {
    describe("正常系", () => {
      it("第3世代・第1世代・第1世代を指定したとき、重複が除かれ第1世代・第3世代の昇順で受理される", () => {
        expect(validateEnabledGenerations([3, 1, 1])).toEqual({ ok: true, generations: [1, 3] });
      });

      it.each([
        ["最小の第1世代", 1],
        ["最大の第8世代", 8],
      ])("%sだけを指定したとき、受理される", (_label, generation) => {
        expect(validateEnabledGenerations([generation]).ok).toBe(true);
      });
    });

    describe("異常系", () => {
      it("世代の一覧が空のとき、最低 1 世代が必要という理由で検証に失敗する", () => {
        expect(validateEnabledGenerations([])).toEqual({
          ok: false,
          message: "at least one generation must be selected",
        });
      });

      it.each([
        ["世代の指定が一覧でなく文字列 x の", "x"],
        ["世代の指定がリクエストの本文に無い", undefined],
      ])("%sとき、世代は一覧で指定する必要があるという理由で検証に失敗する", (_label, raw) => {
        expect(validateEnabledGenerations(raw)).toEqual({
          ok: false,
          message: "generations must be an array",
        });
      });

      it("世代に最小の 1 を下回る 0 を指定したとき、未知の世代 0 という理由で検証に失敗する", () => {
        expect(validateEnabledGenerations([0])).toEqual({
          ok: false,
          message: "unknown generation: 0 (must be one of 1,2,3,4,5,6,7,8)",
        });
      });

      it("世代に最大の 8 を上回る 9 を指定したとき、未知の世代 9 という理由で検証に失敗する", () => {
        expect(validateEnabledGenerations([9])).toEqual({
          ok: false,
          message: "unknown generation: 9 (must be one of 1,2,3,4,5,6,7,8)",
        });
      });

      it("世代に整数でない 1.5 を指定したとき、未知の世代 1.5 という理由で検証に失敗する", () => {
        expect(validateEnabledGenerations([1.5])).toEqual({
          ok: false,
          message: "unknown generation: 1.5 (must be one of 1,2,3,4,5,6,7,8)",
        });
      });
    });
  });
});
