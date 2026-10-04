import { describe, it, expect } from "vitest";
import { buildFlavorTextPairs } from "./flavor-text.js";
import type { FlavorTextSource } from "./flavor-text.js";

function entry(version: string, language: string, text: string): FlavorTextSource {
  return { version, language, text };
}

describe("[ポケモンデータ] 英日説明文ペアの構築", () => {
  describe("正常系", () => {
    it("対象バージョン X の英語と日本語の説明文が揃っているとき、バージョン名 X の英語と日本語の説明文のペアが 1 組できる", () => {
      const pairs = buildFlavorTextPairs([entry("x", "en", "Fast."), entry("x", "ja", "速い。")]);
      expect(pairs).toEqual([
        { version_names: ["X"], description_en: "Fast.", description_ja: "速い。" },
      ]);
    });

    it("同じバージョンに通常表記の日本語とかな表記の日本語の説明文が両方あるとき、通常表記の日本語の説明文がペアの日本語の説明文になる", () => {
      const pairs = buildFlavorTextPairs([
        entry("x", "en", "Fast."),
        entry("x", "ja-Hrkt", "はやい。"),
        entry("x", "ja", "速い。"),
      ]);
      expect(pairs[0].description_ja).toBe("速い。");
    });

    it("通常表記の日本語の説明文が無くかな表記の説明文だけがあるとき、かな表記の説明文がペアの日本語の説明文になる", () => {
      const pairs = buildFlavorTextPairs([entry("x", "en", "Fast."), entry("x", "ja-Hrkt", "はやい。")]);
      expect(pairs[0].description_ja).toBe("はやい。");
    });

    it("バージョン X と Y の英語・日本語の説明文がそれぞれ同じとき、バージョン名 X・Y をまとめた 1 組のペアになる", () => {
      const pairs = buildFlavorTextPairs([
        entry("x", "en", "Fast."),
        entry("x", "ja", "速い。"),
        entry("y", "en", "Fast."),
        entry("y", "ja", "速い。"),
      ]);
      expect(pairs).toHaveLength(1);
      expect(pairs[0].version_names).toEqual(["X", "Y"]);
    });

    it("説明文がソード、X の順に並んでいるとき、ペアの一覧は図鑑の表示順の X、ソードの順に並ぶ", () => {
      const pairs = buildFlavorTextPairs([
        entry("sword", "en", "New."),
        entry("sword", "ja", "新しい。"),
        entry("x", "en", "Old."),
        entry("x", "ja", "古い。"),
      ]);
      expect(pairs.map((p) => p.version_names[0])).toEqual(["X", "ソード"]);
    });

    it.each([
      ["図鑑に表示しないバージョンの英語と日本語の説明文だけがある", [entry("red", "en", "Old."), entry("red", "ja", "古い。")]],
      ["対象バージョン X に日本語の説明文だけがある", [entry("x", "ja", "速い。")]],
      ["対象バージョン X に英語の説明文だけがある", [entry("x", "en", "Fast.")]],
      ["説明文が 1 件も無い", []],
    ] as const)("%sとき、ペアの一覧は空になる", (_label, entries) => {
      expect(buildFlavorTextPairs([...entries])).toEqual([]);
    });
  });
});
