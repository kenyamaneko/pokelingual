import { describe, it, expect } from "vitest";
import { validateTutorialTranslation, validateTutorialName } from "./tutorialValidation";

describe("[チュートリアル] 訳文入力の判定", () => {
  describe("正常系", () => {
    it.each([
      ["「電気タイプのねずみポケモン」", "電気タイプのねずみポケモン"],
      ["「でんきタイプのねずみポケモン」", "でんきタイプのねずみポケモン"],
      ["「電気タイプのネズミポケモン」", "電気タイプのネズミポケモン"],
    ])("入力が%sのとき、送信が許可される", (_label, input) => {
      expect(validateTutorialTranslation(input)).toBe(true);
    });
  });

  describe("異常系", () => {
    it.each([
      ["「電気」「でんき」のどちらも含まない「ねずみポケモン」", "ねずみポケモン"],
      ["「ネズミ」「ねずみ」のどちらも含まない「電気タイプのポケモン」", "電気タイプのポケモン"],
      ["空文字", ""],
    ])("入力が%sのとき、送信が拒否される", (_label, input) => {
      expect(validateTutorialTranslation(input)).toBe(false);
    });
  });
});

describe("[チュートリアル] 名前当ての判定", () => {
  describe("正常系", () => {
    it.each([
      ["日本語名の「ピカチュウ」", "ピカチュウ"],
      ["英語名の小文字「pikachu」", "pikachu"],
      ["英語名の大文字「PIKACHU」", "PIKACHU"],
      ["前後に空白のある「pikachu」", " pikachu "],
    ])("入力が%sのとき、送信が許可される", (_label, input) => {
      expect(validateTutorialName(input)).toBe(true);
    });
  });

  describe("異常系", () => {
    it.each([
      ["ピカチュウの一部「ピカ」", "ピカ"],
      ["別のポケモン名「raichu」", "raichu"],
      ["空文字", ""],
    ])("入力が%sのとき、送信が拒否される", (_label, input) => {
      expect(validateTutorialName(input)).toBe(false);
    });
  });
});
