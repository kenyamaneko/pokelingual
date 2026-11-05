import { describe, it, expect } from "vitest";
import { getScoreLabel } from "./scoreLabel";

describe("[本体:クエスト]最終評価点に応じた『こうか』ラベル", () => {
  describe("単体テスト", () => {
    describe("正常系", () => {
      it("最終評価点が 80 のとき、『こうか』のラベルは『効果は　バツグンだ！』になる", () => {
        expect(getScoreLabel(80)).toBe("効果は　バツグンだ！");
      });

      it.each([40, 1])(
        "最終評価点が %i のとき、『こうか』のラベルは『効果は　いまひとつのようだ』になる",
        (score) => {
          expect(getScoreLabel(score)).toBe("効果は　いまひとつのようだ");
        },
      );

      it("最終評価点が 0 のとき、『こうか』のラベルは『効果が　ないみたいだ...』になる", () => {
        expect(getScoreLabel(0)).toBe("効果が　ないみたいだ...");
      });

      it.each([79, 41])("最終評価点が %i のとき、『こうか』のラベルは表示されない", (score) => {
        expect(getScoreLabel(score)).toBeNull();
      });
    });
  });
});
