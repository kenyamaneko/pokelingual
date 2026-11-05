import { describe, expect } from "vitest";
import { hiraganaToKatakana } from "./kana";
import { defineCase } from "../test/defineCase";

const CONVERT_TO_KATAKANA = "カタカナに変換する";

describe("[本体:設定]ひらがなのカタカナ変換", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "ひらがなだけの「ふしぎだね」のとき",
          When: [CONVERT_TO_KATAKANA],
          Then: "カタカナの「フシギダネ」になる",
        },
      ],
    },
    () => {
      expect(hiraganaToKatakana("ふしぎだね")).toBe("フシギダネ");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "小書き文字を含む「ぴかちゅう」のとき",
          When: [CONVERT_TO_KATAKANA],
          Then: "小書き文字もカタカナになり「ピカチュウ」になる",
        },
      ],
    },
    () => {
      expect(hiraganaToKatakana("ぴかちゅう")).toBe("ピカチュウ");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "ひらがなとカタカナが混ざった「ふしぎダネ」のとき",
          When: [CONVERT_TO_KATAKANA],
          Then: "ひらがなの部分だけがカタカナになり「フシギダネ」になる",
        },
      ],
    },
    () => {
      expect(hiraganaToKatakana("ふしぎダネ")).toBe("フシギダネ");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "長音符を含む「あーぼ」のとき",
          When: [CONVERT_TO_KATAKANA],
          Then: "長音符「ー」はそのままで、ひらがなの部分がカタカナになり「アーボ」になる",
        },
      ],
    },
    () => {
      expect(hiraganaToKatakana("あーぼ")).toBe("アーボ");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "カタカナだけの「フシギダネ」のとき",
          When: [CONVERT_TO_KATAKANA],
          Then: "そのまま「フシギダネ」になる",
        },
      ],
    },
    () => {
      expect(hiraganaToKatakana("フシギダネ")).toBe("フシギダネ");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: "空文字のとき", When: [CONVERT_TO_KATAKANA], Then: "そのまま空文字になる" }],
    },
    () => {
      expect(hiraganaToKatakana("")).toBe("");
    },
  );
});
