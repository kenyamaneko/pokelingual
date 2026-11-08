import { describe, expect } from "vitest";
import { convertHiraganaToKatakana } from "./kana";
import { defineCase } from "../test/defineCase";

const convertToKatakana = (text: string) => `${text}をカタカナに変換する`;

describe("[共通:設定]ひらがなのカタカナ変換", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["同値分割"],
      steps: [
        {
          When: [convertToKatakana("「ふしぎだね」")],
          Then: "カタカナの「フシギダネ」になる",
        },
      ],
    },
    () => {
      expect(convertHiraganaToKatakana("ふしぎだね")).toBe("フシギダネ");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["同値分割"],
      steps: [
        {
          When: [convertToKatakana("「ぴかちゅう」")],
          Then: "小書き文字もカタカナになり「ピカチュウ」になる",
        },
      ],
    },
    () => {
      expect(convertHiraganaToKatakana("ぴかちゅう")).toBe("ピカチュウ");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["同値分割"],
      steps: [
        {
          When: [convertToKatakana("「ふしぎダネ」")],
          Then: "ひらがなの部分だけがカタカナになり「フシギダネ」になる",
        },
      ],
    },
    () => {
      expect(convertHiraganaToKatakana("ふしぎダネ")).toBe("フシギダネ");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["同値分割"],
      steps: [
        {
          When: [convertToKatakana("「あーぼ」")],
          Then: "長音符「ー」はそのままで、ひらがなの部分がカタカナになり「アーボ」になる",
        },
      ],
    },
    () => {
      expect(convertHiraganaToKatakana("あーぼ")).toBe("アーボ");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["同値分割"],
      steps: [
        {
          When: [convertToKatakana("「フシギダネ」")],
          Then: "そのまま「フシギダネ」になる",
        },
      ],
    },
    () => {
      expect(convertHiraganaToKatakana("フシギダネ")).toBe("フシギダネ");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["件数・有無"],
      steps: [{ When: [convertToKatakana("空文字")], Then: "そのまま空文字になる" }],
    },
    () => {
      expect(convertHiraganaToKatakana("")).toBe("");
    },
  );
});
