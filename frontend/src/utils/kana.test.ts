import { describe, it, expect } from "vitest";
import { hiraganaToKatakana } from "./kana";

describe("[検索] ひらがなのカタカナ変換", () => {
  it("ひらがなの文字列は、対応するカタカナに変換される", () => {
    expect(hiraganaToKatakana("ふしぎだね")).toBe("フシギダネ");
  });

  it("小書き文字を含むひらがなは、対応する小書きカタカナに変換される", () => {
    expect(hiraganaToKatakana("ぴかちゅう")).toBe("ピカチュウ");
  });

  it("カタカナの文字列は、変換されずそのまま返る", () => {
    expect(hiraganaToKatakana("フシギダネ")).toBe("フシギダネ");
  });

  it("ひらがなとカタカナが混ざった文字列は、ひらがなの部分だけカタカナに変換される", () => {
    expect(hiraganaToKatakana("ふしぎダネ")).toBe("フシギダネ");
  });

  it("長音符「ー」は、変換されずそのまま返る", () => {
    expect(hiraganaToKatakana("あーぼ")).toBe("アーボ");
  });

  it("空文字は、空文字のまま返る", () => {
    expect(hiraganaToKatakana("")).toBe("");
  });
});
