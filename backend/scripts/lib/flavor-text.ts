import type { FlavorTextPair } from "../../../shared/api-types/pokedex.js";

/** 図鑑に表示する対象バージョンと表示名。配列の並び順がそのまま図鑑での表示順を兼ねる。 */
const displayVersions: readonly { id: string; displayName: string }[] = [
  { id: "x", displayName: "X" },
  { id: "y", displayName: "Y" },
  { id: "omega-ruby", displayName: "Ωルビー" },
  { id: "alpha-sapphire", displayName: "αサファイア" },
  { id: "sun", displayName: "サン" },
  { id: "moon", displayName: "ムーン" },
  { id: "ultra-sun", displayName: "Uサン" },
  { id: "ultra-moon", displayName: "Uムーン" },
  { id: "lets-go-pikachu", displayName: "ピカブイ" },
  { id: "lets-go-eevee", displayName: "ピカブイ" },
  { id: "sword", displayName: "ソード" },
  { id: "shield", displayName: "シールド" },
];

const targetVersionIds = new Set(displayVersions.map((v) => v.id));

/** 説明文 1 件 (バージョン・言語・整形済みテキスト)。データソース非依存の中立形。 */
export interface FlavorTextSource {
  version: string;
  language: string;
  text: string;
}

interface FlavorTextsByVersion {
  en: string;
  ja: string;
  jaHrkt: string;
}

/**
 * 説明文エントリを version ごとに EN/JA ペアへ整形する。
 * @param entries バージョン・言語・説明文の組の配列。
 * @returns version 順に並んだ EN/JA 説明ペアの配列。
 */
export function buildFlavorTextPairs(entries: FlavorTextSource[]): FlavorTextPair[] {
  const byVersion = new Map<string, FlavorTextsByVersion>();

  for (const entry of entries) {
    const ver = entry.version;
    if (!targetVersionIds.has(ver)) continue;

    if (!byVersion.has(ver)) {
      byVersion.set(ver, { en: "", ja: "", jaHrkt: "" });
    }
    const texts = byVersion.get(ver)!;

    switch (entry.language) {
      case "en": texts.en = entry.text; break;
      case "ja": texts.ja = entry.text; break;
      case "ja-Hrkt": texts.jaHrkt = entry.text; break;
      // PokeAPI は fr/de/ko 等 多数の言語を返すが、本アプリの対象は EN/JA のみなので無視する
      default: break;
    }
  }

  // displayVersions の並び順で走査するため、出力は表示順に揃い別途の並べ替えが要らない。
  const result: FlavorTextPair[] = [];
  for (const { id, displayName } of displayVersions) {
    const texts = byVersion.get(id);
    if (!texts) continue;

    const ja = texts.ja || texts.jaHrkt;
    if (!texts.en || !ja) continue;

    const existing = result.find(
      (r) => r.description_en === texts.en && r.description_ja === ja,
    );
    if (existing) {
      if (!existing.version_names.includes(displayName)) {
        existing.version_names.push(displayName);
      }
    } else {
      result.push({
        version_names: [displayName],
        description_en: texts.en,
        description_ja: ja,
      });
    }
  }

  return result;
}
