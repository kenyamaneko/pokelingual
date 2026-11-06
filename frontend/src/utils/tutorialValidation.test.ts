import { describe, expect } from "vitest";
import { validateTutorialTranslation, validateTutorialName } from "./tutorialValidation";
import { defineCase, type Viewpoint } from "../test/defineCase";

describe("[本体:チュートリアル]英文当てステップの入力の判定", () => {
  const ACCEPTED_TRANSLATION_CASES: { label: string; input: string; 観点: readonly Viewpoint[] }[] = [
    { label: "「電気タイプのねずみポケモン」", input: "電気タイプのねずみポケモン", 観点: ["同値分割"] },
    { label: "「でんきタイプのねずみポケモン」", input: "でんきタイプのねずみポケモン", 観点: ["同値分割"] },
    { label: "「電気タイプのネズミポケモン」", input: "電気タイプのネズミポケモン", 観点: ["同値分割"] },
  ];

  for (const { label, input, 観点 } of ACCEPTED_TRANSLATION_CASES) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        観点,
        steps: [{ Given: `入力が${label}のとき`, When: ["英文当てステップの入力を判定する"], Then: "送信が許可される" }],
      },
      () => {
        expect(validateTutorialTranslation(input)).toBe(true);
      },
    );
  }

  const REJECTED_TRANSLATION_CASES: { label: string; input: string; 観点: readonly Viewpoint[] }[] = [
    { label: "「電気」「でんき」のどちらも含まない「ねずみポケモン」", input: "ねずみポケモン", 観点: ["同値分割"] },
    { label: "「ネズミ」「ねずみ」のどちらも含まない「電気タイプのポケモン」", input: "電気タイプのポケモン", 観点: ["同値分割"] },
    { label: "空文字", input: "", 観点: ["件数・有無", "エッジケース"] },
  ];

  for (const { label, input, 観点 } of REJECTED_TRANSLATION_CASES) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "異常系",
        観点,
        steps: [{ Given: `入力が${label}のとき`, When: ["英文当てステップの入力を判定する"], Then: "送信が拒否される" }],
      },
      () => {
        expect(validateTutorialTranslation(input)).toBe(false);
      },
    );
  }
});

describe("[本体:チュートリアル]ポケモン名当てステップの入力の判定", () => {
  const ACCEPTED_NAME_CASES: { label: string; input: string; 観点: readonly Viewpoint[] }[] = [
    { label: "日本語名の「ピカチュウ」", input: "ピカチュウ", 観点: ["同値分割"] },
    { label: "英語名の小文字「pikachu」", input: "pikachu", 観点: ["同値分割"] },
    { label: "英語名の大文字「PIKACHU」", input: "PIKACHU", 観点: ["同値分割"] },
    { label: "前後に空白のある「 pikachu 」", input: " pikachu ", 観点: ["同値分割"] },
  ];

  for (const { label, input, 観点 } of ACCEPTED_NAME_CASES) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        観点,
        steps: [{ Given: `入力が${label}のとき`, When: ["ポケモン名当てステップの入力を判定する"], Then: "送信が許可される" }],
      },
      () => {
        expect(validateTutorialName(input)).toBe(true);
      },
    );
  }

  const REJECTED_NAME_CASES: { label: string; input: string; 観点: readonly Viewpoint[] }[] = [
    { label: "ピカチュウの一部「ピカ」", input: "ピカ", 観点: ["同値分割"] },
    { label: "別のポケモン名「raichu」", input: "raichu", 観点: ["同値分割"] },
    { label: "空文字", input: "", 観点: ["件数・有無", "エッジケース"] },
  ];

  for (const { label, input, 観点 } of REJECTED_NAME_CASES) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "異常系",
        観点,
        steps: [{ Given: `入力が${label}のとき`, When: ["ポケモン名当てステップの入力を判定する"], Then: "送信が拒否される" }],
      },
      () => {
        expect(validateTutorialName(input)).toBe(false);
      },
    );
  }
});
