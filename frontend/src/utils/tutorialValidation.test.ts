import { describe, it, expect } from "vitest";
import { validateTutorialTranslation, validateTutorialName } from "./tutorialValidation";

describe("チュートリアルの訳文判定", () => {
  it.each([
    "電気タイプのねずみポケモン",
    "でんきタイプのねずみポケモン",
    "電気タイプのネズミポケモン",
  ])("「%s」は、必須キーワードを満たす", (input) => {
    expect(validateTutorialTranslation(input)).toBe(true);
  });

  it.each([
    ["ねずみポケモン", "ねずみポケモン"],
    ["電気タイプのポケモン", "電気タイプのポケモン"],
    ["空文字", ""],
  ])("「%s」は、必須キーワードを満たさない", (_label, input) => {
    expect(validateTutorialTranslation(input)).toBe(false);
  });
});

describe("チュートリアルの名前当て判定", () => {
  it.each([
    "ピカチュウ",
    "pikachu",
    "PIKACHU",
    " pikachu ",
  ])("「%s」は、ピカチュウとして一致する", (input) => {
    expect(validateTutorialName(input)).toBe(true);
  });

  it.each([
    ["ピカ", "ピカ"],
    ["raichu", "raichu"],
    ["空文字", ""],
  ])("「%s」は、ピカチュウとして一致しない", (_label, input) => {
    expect(validateTutorialName(input)).toBe(false);
  });
});
