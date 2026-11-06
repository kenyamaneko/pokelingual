import { describe, expect } from "vitest";
import { validateTutorialTranslation, validateTutorialName } from "./tutorialValidation";
import { defineCase } from "../test/defineCase";

describe("[本体:チュートリアル]英文当てステップの入力の判定", () => {
  for (const { label, input } of [
    { label: "「電気タイプのねずみポケモン」", input: "電気タイプのねずみポケモン" },
    { label: "「でんきタイプのねずみポケモン」", input: "でんきタイプのねずみポケモン" },
    { label: "「電気タイプのネズミポケモン」", input: "電気タイプのネズミポケモン" },
  ]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        steps: [{ Given: `入力が${label}のとき`, When: ["英文当てステップの入力を判定する"], Then: "送信が許可される" }],
      },
      () => {
        expect(validateTutorialTranslation(input)).toBe(true);
      },
    );
  }

  for (const { label, input } of [
    { label: "「電気」「でんき」のどちらも含まない「ねずみポケモン」", input: "ねずみポケモン" },
    { label: "「ネズミ」「ねずみ」のどちらも含まない「電気タイプのポケモン」", input: "電気タイプのポケモン" },
    { label: "空文字", input: "" },
  ]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "異常系",
        steps: [{ Given: `入力が${label}のとき`, When: ["英文当てステップの入力を判定する"], Then: "送信が拒否される" }],
      },
      () => {
        expect(validateTutorialTranslation(input)).toBe(false);
      },
    );
  }
});

describe("[本体:チュートリアル]ポケモン名当てステップの入力の判定", () => {
  for (const { label, input } of [
    { label: "日本語名の「ピカチュウ」", input: "ピカチュウ" },
    { label: "英語名の小文字「pikachu」", input: "pikachu" },
    { label: "英語名の大文字「PIKACHU」", input: "PIKACHU" },
    { label: "前後に空白のある「 pikachu 」", input: " pikachu " },
  ]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        steps: [{ Given: `入力が${label}のとき`, When: ["ポケモン名当てステップの入力を判定する"], Then: "送信が許可される" }],
      },
      () => {
        expect(validateTutorialName(input)).toBe(true);
      },
    );
  }

  for (const { label, input } of [
    { label: "ピカチュウの一部「ピカ」", input: "ピカ" },
    { label: "別のポケモン名「raichu」", input: "raichu" },
    { label: "空文字", input: "" },
  ]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "異常系",
        steps: [{ Given: `入力が${label}のとき`, When: ["ポケモン名当てステップの入力を判定する"], Then: "送信が拒否される" }],
      },
      () => {
        expect(validateTutorialName(input)).toBe(false);
      },
    );
  }
});
