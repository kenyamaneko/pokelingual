import { describe, expect } from "vitest";
import { buildFlavorTextPairs } from "./flavor-text.js";
import type { FlavorTextSource } from "./flavor-text.js";
import { defineCase } from "../../src/test/defineCase.js";

function entry(version: string, language: string, text: string): FlavorTextSource {
  return { version, language, text };
}

const BUILD_PAIRS = "説明文ペアの一覧を構築する";

describe("[外部連携:ポケモンデータ提供元]英日説明文ペアの構築", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "バージョン X の英語の説明文「Fast.」と日本語の説明文「速い。」が揃っているとき",
          When: [BUILD_PAIRS],
          Then: "説明文ペアの一覧は、バージョン名 X・英語「Fast.」・日本語「速い。」の 1 組になる",
        },
      ],
    },
    () => {
      const pairs = buildFlavorTextPairs([entry("x", "en", "Fast."), entry("x", "ja", "速い。")]);
      expect(pairs).toEqual([
        { version_names: ["X"], description_en: "Fast.", description_ja: "速い。" },
      ]);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "同じバージョンに、通常表記の日本語の説明文「速い。」とかな表記の日本語の説明文「はやい。」が両方あるとき",
          When: [BUILD_PAIRS],
          Then: "説明文ペアの日本語の説明文は「速い。」になる",
        },
      ],
    },
    () => {
      const pairs = buildFlavorTextPairs([
        entry("x", "en", "Fast."),
        entry("x", "ja-Hrkt", "はやい。"),
        entry("x", "ja", "速い。"),
      ]);
      expect(pairs[0].description_ja).toBe("速い。");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "通常表記の日本語の説明文が無く、かな表記の日本語の説明文「はやい。」だけがあるとき",
          When: [BUILD_PAIRS],
          Then: "説明文ペアの日本語の説明文は「はやい。」になる",
        },
      ],
    },
    () => {
      const pairs = buildFlavorTextPairs([entry("x", "en", "Fast."), entry("x", "ja-Hrkt", "はやい。")]);
      expect(pairs[0].description_ja).toBe("はやい。");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "バージョン X と Y の英語の説明文が「Fast.」、日本語の説明文が「速い。」でそれぞれ同じとき",
          When: [BUILD_PAIRS],
          Then: "説明文ペアの一覧は、バージョン名 X・Y をまとめた 1 組になる",
        },
      ],
    },
    () => {
      const pairs = buildFlavorTextPairs([
        entry("x", "en", "Fast."),
        entry("x", "ja", "速い。"),
        entry("y", "en", "Fast."),
        entry("y", "ja", "速い。"),
      ]);
      expect(pairs).toHaveLength(1);
      expect(pairs[0].version_names).toEqual(["X", "Y"]);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "説明文がソード、X の順に並んでいるとき",
          When: [BUILD_PAIRS],
          Then: "説明文ペアの一覧は X、ソードの順に並ぶ",
        },
      ],
    },
    () => {
      const pairs = buildFlavorTextPairs([
        entry("sword", "en", "New."),
        entry("sword", "ja", "新しい。"),
        entry("x", "en", "Old."),
        entry("x", "ja", "古い。"),
      ]);
      expect(pairs.map((p) => p.version_names[0])).toEqual(["X", "ソード"]);
    },
  );

  for (const { given, entries } of [
    {
      given: "図鑑に表示しないバージョン (red) の英語の説明文「Old.」と日本語の説明文「古い。」だけがあるとき",
      entries: [entry("red", "en", "Old."), entry("red", "ja", "古い。")],
    },
    { given: "バージョン X に日本語の説明文「速い。」だけがあるとき", entries: [entry("x", "ja", "速い。")] },
    { given: "バージョン X に英語の説明文「Fast.」だけがあるとき", entries: [entry("x", "en", "Fast.")] },
    { given: "説明文が 1 件も無いとき", entries: [] },
  ]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        steps: [{ Given: given, When: [BUILD_PAIRS], Then: "説明文ペアの一覧は空になる" }],
      },
      () => {
        expect(buildFlavorTextPairs([...entries])).toEqual([]);
      },
    );
  }
});
