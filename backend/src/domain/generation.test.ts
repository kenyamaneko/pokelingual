import { describe, it, expect } from "vitest";
import {
  generationsToPokemonIDs,
  buildQuestPoolIDs,
  validateEnabledGenerations,
} from "./generation.js";

describe("[出題] 選択世代に含まれる図鑑番号", () => {
  describe("正常系", () => {
    it.each([
      ["第1世代のみを選択した", "図鑑番号 1 と 151", [1], [1, 151]],
      ["第2世代のみを選択した", "図鑑番号 152 と 251", [2], [152, 251]],
      ["第3世代のみを選択した", "図鑑番号 252", [3], [252]],
      ["第2世代と第4世代を選択した", "図鑑番号 200 と 400", [2, 4], [200, 400]],
    ])("%sとき、%s を含む", (_label, _display, generations, included) => {
      const ids = generationsToPokemonIDs(generations);
      for (const id of included) {
        expect(ids.has(id)).toBe(true);
      }
    });

    it("第1世代のみを選択したとき、図鑑番号は 151 件になる", () => {
      expect(generationsToPokemonIDs([1]).size).toBe(151);
    });

    it.each([
      ["第1世代のみを選択した", "図鑑番号 152", [1], [152]],
      ["第2世代のみを選択した", "図鑑番号 151 と 252", [2], [151, 252]],
      ["第3世代のみを選択した", "図鑑番号 1 と 151", [3], [1, 151]],
      ["第2世代と第4世代を選択した", "第3世代の図鑑番号 300", [2, 4], [300]],
    ])("%sとき、%s を含まない", (_label, _display, generations, excluded) => {
      const ids = generationsToPokemonIDs(generations);
      for (const id of excluded) {
        expect(ids.has(id)).toBe(false);
      }
    });
  });

  describe("異常系", () => {
    it("世代を 1 つも選択していないとき、図鑑番号は 0 件になる", () => {
      expect(generationsToPokemonIDs([]).size).toBe(0);
    });
  });
});

describe("[出題] 出題プールの図鑑番号", () => {
  describe("正常系", () => {
    describe("第1世代を選択し、図鑑番号 5 と 10 を除外したとき", () => {
      const pool = buildQuestPoolIDs([1], new Set([5, 10]));

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

describe("[設定] 出題世代設定の検証", () => {
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
      ["世代の指定が一覧でなく文字列の", "x"],
      ["世代の指定がリクエストの本文に無い", undefined],
    ])("%sとき、世代は一覧で指定する必要があるという理由で検証に失敗する", (_label, raw) => {
      expect(validateEnabledGenerations(raw)).toEqual({
        ok: false,
        message: "generations must be an array",
      });
    });

    it.each([
      ["最小の 1 を下回る 0", 0, "unknown generation: 0 (must be one of 1,2,3,4,5,6,7,8)"],
      ["最大の 8 を上回る 9", 9, "unknown generation: 9 (must be one of 1,2,3,4,5,6,7,8)"],
      ["整数でない 1.5", 1.5, "unknown generation: 1.5 (must be one of 1,2,3,4,5,6,7,8)"],
    ])("世代に%sを指定したとき、未知の世代という理由で検証に失敗する", (_label, generation, message) => {
      expect(validateEnabledGenerations([generation])).toEqual({ ok: false, message });
    });
  });
});
