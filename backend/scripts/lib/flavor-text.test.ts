import { describe, it, expect } from "vitest";
import { buildFlavorTextPairs } from "./flavor-text.js";
import type { FlavorTextSource } from "./flavor-text.js";

function entry(version: string, language: string, text: string): FlavorTextSource {
  return { version, language, text };
}

describe("[外部連携:ポケモンデータ:スナップショット生成]英日説明文ペアの構築", () => {
  describe("単体テスト", () => {
    describe("正常系", () => {
      it("バージョン X の英語の説明文「Fast.」と日本語の説明文「速い。」が揃っているとき、説明文ペアの一覧は、バージョン名 X・英語「Fast.」・日本語「速い。」の 1 組になる", () => {
        const pairs = buildFlavorTextPairs([entry("x", "en", "Fast."), entry("x", "ja", "速い。")]);
        expect(pairs).toEqual([
          { version_names: ["X"], description_en: "Fast.", description_ja: "速い。" },
        ]);
      });

      it("同じバージョンに、通常表記の日本語の説明文「速い。」とかな表記の日本語の説明文「はやい。」が両方あるとき、説明文ペアの日本語の説明文は「速い。」になる", () => {
        const pairs = buildFlavorTextPairs([
          entry("x", "en", "Fast."),
          entry("x", "ja-Hrkt", "はやい。"),
          entry("x", "ja", "速い。"),
        ]);
        expect(pairs[0].description_ja).toBe("速い。");
      });

      it("通常表記の日本語の説明文が無く、かな表記の日本語の説明文「はやい。」だけがあるとき、説明文ペアの日本語の説明文は「はやい。」になる", () => {
        const pairs = buildFlavorTextPairs([entry("x", "en", "Fast."), entry("x", "ja-Hrkt", "はやい。")]);
        expect(pairs[0].description_ja).toBe("はやい。");
      });

      it("バージョン X と Y の英語の説明文が「Fast.」、日本語の説明文が「速い。」でそれぞれ同じとき、説明文ペアの一覧は、バージョン名 X・Y をまとめた 1 組になる", () => {
        const pairs = buildFlavorTextPairs([
          entry("x", "en", "Fast."),
          entry("x", "ja", "速い。"),
          entry("y", "en", "Fast."),
          entry("y", "ja", "速い。"),
        ]);
        expect(pairs).toHaveLength(1);
        expect(pairs[0].version_names).toEqual(["X", "Y"]);
      });

      it("説明文がソード、X の順に並んでいるとき、説明文ペアの一覧は X、ソードの順に並ぶ", () => {
        const pairs = buildFlavorTextPairs([
          entry("sword", "en", "New."),
          entry("sword", "ja", "新しい。"),
          entry("x", "en", "Old."),
          entry("x", "ja", "古い。"),
        ]);
        expect(pairs.map((p) => p.version_names[0])).toEqual(["X", "ソード"]);
      });

      it.each([
        [
          "図鑑に表示しないバージョン (red) の英語の説明文「Old.」と日本語の説明文「古い。」だけがある",
          [entry("red", "en", "Old."), entry("red", "ja", "古い。")],
        ],
        ["バージョン X に日本語の説明文「速い。」だけがある", [entry("x", "ja", "速い。")]],
        ["バージョン X に英語の説明文「Fast.」だけがある", [entry("x", "en", "Fast.")]],
        ["説明文が 1 件も無い", []],
      ] as const)("%sとき、説明文ペアの一覧は空になる", (_given, entries) => {
        expect(buildFlavorTextPairs([...entries])).toEqual([]);
      });
    });
  });
});
