import { describe, it, expect } from "vitest";
import { buildFlavorTextPairs } from "./flavor-text.js";
import type { FlavorTextSource } from "./flavor-text.js";

/**
 * 説明文エントリのダミーを作る。
 * @param version version 名。
 * @param language 言語コード。
 * @param text 説明文。
 * @returns エントリ 1 件。
 */
function entry(version: string, language: string, text: string): FlavorTextSource {
  return { version, language, text };
}

describe("buildFlavorTextPairs", () => {
  it("対象バージョンの EN/JA が揃えばペアになる", () => {
    const pairs = buildFlavorTextPairs([entry("x", "en", "Fast."), entry("x", "ja", "速い。")]);
    expect(pairs).toEqual([
      { version_names: ["X"], description_en: "Fast.", description_ja: "速い。" },
    ]);
  });

  it("対象外バージョンのエントリは無視される", () => {
    const pairs = buildFlavorTextPairs([entry("red", "en", "Old."), entry("red", "ja", "古い。")]);
    expect(pairs).toEqual([]);
  });

  it("ja と ja-Hrkt が両方あれば ja を優先する", () => {
    const pairs = buildFlavorTextPairs([
      entry("x", "en", "Fast."),
      entry("x", "ja-Hrkt", "はやい。"),
      entry("x", "ja", "速い。"),
    ]);
    expect(pairs[0].description_ja).toBe("速い。");
  });

  it("ja が無ければ ja-Hrkt にフォールバックする", () => {
    const pairs = buildFlavorTextPairs([entry("x", "en", "Fast."), entry("x", "ja-Hrkt", "はやい。")]);
    expect(pairs[0].description_ja).toBe("はやい。");
  });

  it("EN が欠けたバージョンはペアにしない", () => {
    expect(buildFlavorTextPairs([entry("x", "ja", "速い。")])).toEqual([]);
  });

  it("JA が欠けたバージョンはペアにしない", () => {
    expect(buildFlavorTextPairs([entry("x", "en", "Fast.")])).toEqual([]);
  });

  it("EN/JA とも同一テキストのバージョンは version_names にマージされる", () => {
    const pairs = buildFlavorTextPairs([
      entry("x", "en", "Fast."),
      entry("x", "ja", "速い。"),
      entry("y", "en", "Fast."),
      entry("y", "ja", "速い。"),
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].version_names).toEqual(["X", "Y"]);
  });

  it("入力順に関わらず世代順 (versionOrder) に並ぶ", () => {
    const pairs = buildFlavorTextPairs([
      entry("sword", "en", "New."),
      entry("sword", "ja", "新しい。"),
      entry("x", "en", "Old."),
      entry("x", "ja", "古い。"),
    ]);
    expect(pairs.map((p) => p.version_names[0])).toEqual(["X", "ソード"]);
  });

  it("エントリが空なら空配列", () => {
    expect(buildFlavorTextPairs([])).toEqual([]);
  });
});
