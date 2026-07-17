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

describe("[ポケモンデータ] 英日説明文ペアの構築", () => {
  it("対象バージョンの英語と日本語が揃えばペアになる", () => {
    const pairs = buildFlavorTextPairs([entry("x", "en", "Fast."), entry("x", "ja", "速い。")]);
    expect(pairs).toEqual([
      { version_names: ["X"], description_en: "Fast.", description_ja: "速い。" },
    ]);
  });

  it("対象外バージョンのエントリは無視される", () => {
    const pairs = buildFlavorTextPairs([entry("red", "en", "Old."), entry("red", "ja", "古い。")]);
    expect(pairs).toEqual([]);
  });

  it("通常表記の日本語とかな表記の説明文が両方あれば、通常表記を優先する", () => {
    const pairs = buildFlavorTextPairs([
      entry("x", "en", "Fast."),
      entry("x", "ja-Hrkt", "はやい。"),
      entry("x", "ja", "速い。"),
    ]);
    expect(pairs[0].description_ja).toBe("速い。");
  });

  it("通常表記の日本語が無ければ、かな表記の説明文を使う", () => {
    const pairs = buildFlavorTextPairs([entry("x", "en", "Fast."), entry("x", "ja-Hrkt", "はやい。")]);
    expect(pairs[0].description_ja).toBe("はやい。");
  });

  it("英語の説明文が欠けたバージョンはペアにしない", () => {
    expect(buildFlavorTextPairs([entry("x", "ja", "速い。")])).toEqual([]);
  });

  it("日本語の説明文が欠けたバージョンはペアにしない", () => {
    expect(buildFlavorTextPairs([entry("x", "en", "Fast.")])).toEqual([]);
  });

  it("英語・日本語とも同じ説明文のバージョンは、バージョン名の一覧としてまとめられる", () => {
    const pairs = buildFlavorTextPairs([
      entry("x", "en", "Fast."),
      entry("x", "ja", "速い。"),
      entry("y", "en", "Fast."),
      entry("y", "ja", "速い。"),
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].version_names).toEqual(["X", "Y"]);
  });

  it("入力順に関わらず、世代の順番に並ぶ", () => {
    const pairs = buildFlavorTextPairs([
      entry("sword", "en", "New."),
      entry("sword", "ja", "新しい。"),
      entry("x", "en", "Old."),
      entry("x", "ja", "古い。"),
    ]);
    expect(pairs.map((p) => p.version_names[0])).toEqual(["X", "ソード"]);
  });

  it("エントリが空なら空配列になる", () => {
    expect(buildFlavorTextPairs([])).toEqual([]);
  });
});
