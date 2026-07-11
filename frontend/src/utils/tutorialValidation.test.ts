import { describe, it, expect } from "vitest";
import { validateTutorialTranslation, validateTutorialName } from "./tutorialValidation";

describe("validateTutorialTranslation (訳文のキーワード判定)", () => {
  it.each([
    { input: "電気タイプのねずみポケモン", expected: true },
    { input: "でんきタイプのねずみポケモン", expected: true },
    { input: "電気タイプのネズミポケモン", expected: true },
    { input: "ねずみポケモン", expected: false },
    { input: "電気タイプのポケモン", expected: false },
    { input: "", expected: false },
  ])("入力が「$input」のとき、判定は $expected になる", ({ input, expected }) => {
    expect(validateTutorialTranslation(input)).toBe(expected);
  });
});

describe("validateTutorialName (ポケモン名の完全一致判定)", () => {
  it.each([
    { input: "ピカチュウ", expected: true },
    { input: "pikachu", expected: true },
    { input: "PIKACHU", expected: true },
    { input: " pikachu ", expected: true },
    { input: "ピカ", expected: false },
    { input: "raichu", expected: false },
    { input: "", expected: false },
  ])("入力が「$input」のとき、判定は $expected になる", ({ input, expected }) => {
    expect(validateTutorialName(input)).toBe(expected);
  });
});
