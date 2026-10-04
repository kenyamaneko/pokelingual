import { describe, it, expect } from "vitest";
import { hiraganaToKatakana } from "./kana";

describe("[苦手ポケモン検索] ひらがなのカタカナ変換", () => {
  describe("正常系", () => {
    it("ひらがなだけの「ふしぎだね」を変換すると、「フシギダネ」になる", () => {
      expect(hiraganaToKatakana("ふしぎだね")).toBe("フシギダネ");
    });

    it("小書き文字を含む「ぴかちゅう」を変換すると、小書き文字もカタカナになり「ピカチュウ」になる", () => {
      expect(hiraganaToKatakana("ぴかちゅう")).toBe("ピカチュウ");
    });

    it("ひらがなとカタカナが混ざった「ふしぎダネ」を変換すると、ひらがなの部分だけがカタカナになり「フシギダネ」になる", () => {
      expect(hiraganaToKatakana("ふしぎダネ")).toBe("フシギダネ");
    });

    it("長音符を含む「あーぼ」を変換すると、長音符「ー」はそのままで、ひらがなの部分がカタカナになり「アーボ」になる", () => {
      expect(hiraganaToKatakana("あーぼ")).toBe("アーボ");
    });

    it.each([
      ["カタカナだけの「フシギダネ」", "フシギダネ"],
      ["空文字", ""],
    ])("%sを変換しても、同じ文字列のままになる", (_label, input) => {
      expect(hiraganaToKatakana(input)).toBe(input);
    });
  });
});
