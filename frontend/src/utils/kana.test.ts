import { describe, it, expect } from "vitest";
import { hiraganaToKatakana } from "./kana";

describe("[本体:除外ポケモン検索]ひらがなのカタカナ変換", () => {
  describe("単体テスト", () => {
    describe("正常系", () => {
      it("ひらがなだけの「ふしぎだね」は、カタカナの「フシギダネ」になる", () => {
        expect(hiraganaToKatakana("ふしぎだね")).toBe("フシギダネ");
      });

      it("小書き文字を含む「ぴかちゅう」は、小書き文字もカタカナになり「ピカチュウ」になる", () => {
        expect(hiraganaToKatakana("ぴかちゅう")).toBe("ピカチュウ");
      });

      it("ひらがなとカタカナが混ざった「ふしぎダネ」は、ひらがなの部分だけがカタカナになり「フシギダネ」になる", () => {
        expect(hiraganaToKatakana("ふしぎダネ")).toBe("フシギダネ");
      });

      it("長音符を含む「あーぼ」は、長音符「ー」はそのままで、ひらがなの部分がカタカナになり「アーボ」になる", () => {
        expect(hiraganaToKatakana("あーぼ")).toBe("アーボ");
      });

      it("カタカナだけの「フシギダネ」は、そのまま「フシギダネ」になる", () => {
        expect(hiraganaToKatakana("フシギダネ")).toBe("フシギダネ");
      });

      it("空文字は、そのまま空文字になる", () => {
        expect(hiraganaToKatakana("")).toBe("");
      });
    });
  });
});
