import { describe, it, expect } from "vitest";
import {
  calculateCaptureRate,
  maskPokemonNameEN,
  maskPokemonNameJA,
} from "./quest-service.js";

/**
 * 捕獲確率の仕様 (ADR-010)。式そのものは書き写さず、外から観測できる性質で確かめる。
 */
describe("calculateCaptureRate", () => {
  it("確率は下限 0 以上", () => {
    expect(calculateCaptureRate(0, 900, 1.0)).toBeGreaterThanOrEqual(0);
  });

  it("倍率で 1.0 を超える場合は 1.0 にクランプされる", () => {
    expect(calculateCaptureRate(100, 100, 3.0)).toBe(1);
  });

  it("スコアが高いほど捕獲確率が上がる (BST/ボール固定)", () => {
    expect(calculateCaptureRate(90, 300, 1.0)).toBeGreaterThan(calculateCaptureRate(30, 300, 1.0));
  });

  it("BST が高いほど捕獲確率が下がる (スコア/ボール固定)", () => {
    expect(calculateCaptureRate(50, 300, 1.0)).toBeGreaterThan(calculateCaptureRate(50, 680, 1.0));
  });

  it("ボール倍率が高いほど捕獲確率が上がる", () => {
    expect(calculateCaptureRate(0, 680, 3.0)).toBeGreaterThan(calculateCaptureRate(0, 680, 1.0));
  });

  it("スコア90 + スーパーボールなら高BST(680)でもほぼ確実 (ADR-010)", () => {
    expect(calculateCaptureRate(90, 680, 2.0)).toBeGreaterThan(0.99);
  });
});

/**
 * 英語名の伏せ字仕様。純関数なので具体値で直接確かめる。
 */
describe("maskPokemonNameEN", () => {
  it("name が空なら原文のまま", () => {
    expect(maskPokemonNameEN("A wild creature.", "")).toBe("A wild creature.");
  });

  it("name が本文に無ければ原文のまま", () => {
    expect(maskPokemonNameEN("Hello world", "Pikachu")).toBe("Hello world");
  });

  it("文中の出現は小文字始まりの this Pokémon に置換", () => {
    expect(maskPokemonNameEN("A wild Pikachu appeared.", "Pikachu")).toBe(
      "A wild this Pokémon appeared.",
    );
  });

  it("文頭の出現は大文字始まりの This Pokémon に置換", () => {
    expect(maskPokemonNameEN("Pikachu is yellow.", "Pikachu")).toBe("This Pokémon is yellow.");
  });

  it("文末記号 (.!?) の直後も文頭扱いで大文字化", () => {
    expect(maskPokemonNameEN("Hello. Pikachu runs.", "Pikachu")).toBe("Hello. This Pokémon runs.");
  });

  it("複数形ヒント (several 等) の直後は of these Pokémon に置換", () => {
    expect(maskPokemonNameEN("Several Pikachu gather.", "Pikachu")).toBe(
      "Several of these Pokémon gather.",
    );
  });

  it("複数箇所すべて置換する", () => {
    expect(maskPokemonNameEN("Pikachu and Pikachu", "Pikachu")).toBe(
      "This Pokémon and this Pokémon",
    );
  });

  it("大文字小文字を無視して一致する", () => {
    expect(maskPokemonNameEN("A pikachu here", "Pikachu")).toBe("A this Pokémon here");
  });
});

/**
 * 日本語名の伏せ字仕様。
 */
describe("maskPokemonNameJA", () => {
  it("出現を「この ポケモン」に置換する", () => {
    expect(maskPokemonNameJA("ピカチュウは黄色い", "ピカチュウ")).toBe("この ポケモンは黄色い");
  });

  it("複数箇所すべて置換する", () => {
    expect(maskPokemonNameJA("ピカチュウとピカチュウ", "ピカチュウ")).toBe(
      "この ポケモンとこの ポケモン",
    );
  });

  it("name が空なら原文のまま", () => {
    expect(maskPokemonNameJA("あいうえお", "")).toBe("あいうえお");
  });

  it("name が本文に無ければ原文のまま", () => {
    expect(maskPokemonNameJA("あいうえお", "ピカチュウ")).toBe("あいうえお");
  });
});
