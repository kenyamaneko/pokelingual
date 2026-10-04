import { describe, it, expect } from "vitest";
import { getScoreLabel } from "./scoreLabel";

describe("[クエスト] 最終評価点に応じた『こうか』ラベル", () => {
  describe("正常系", () => {
    it.each([
      [99, "効果は　バツグンだ！"],
      [80, "効果は　バツグンだ！"],
    ])("最終評価点が %i のとき、『%s』と表示される", (score, label) => {
      expect(getScoreLabel(score)).toBe(label);
    });

    it.each([
      [40, "効果は　いまひとつのようだ"],
      [1, "効果は　いまひとつのようだ"],
    ])("最終評価点が %i のとき、『%s』と表示される", (score, label) => {
      expect(getScoreLabel(score)).toBe(label);
    });

    it("最終評価点が 0 のとき、『効果が　ないみたいだ...』と表示される", () => {
      expect(getScoreLabel(0)).toBe("効果が　ないみたいだ...");
    });

    it.each([79, 41])("最終評価点が %i のとき、『こうか』のラベルは表示されない", (score) => {
      expect(getScoreLabel(score)).toBeNull();
    });
  });
});
