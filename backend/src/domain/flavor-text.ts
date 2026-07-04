import type { FlavorTextPair } from "../../../shared/api-types/pokedex.js";

/** 図鑑に表示する対象バージョンとその表示順。 */
const versionOrder = [
  "x", "y", "omega-ruby", "alpha-sapphire",
  "sun", "moon", "ultra-sun", "ultra-moon",
  "lets-go-pikachu", "lets-go-eevee",
  "sword", "shield",
];

/** version 識別子 → 図鑑に表示するバージョン名。 */
const versionDisplayNames: Record<string, string> = {
  "x": "X",
  "y": "Y",
  "omega-ruby": "Ωルビー",
  "alpha-sapphire": "αサファイア",
  "sun": "サン",
  "moon": "ムーン",
  "ultra-sun": "Uサン",
  "ultra-moon": "Uムーン",
  "lets-go-pikachu": "ピカブイ",
  "lets-go-eevee": "ピカブイ",
  "sword": "ソード",
  "shield": "シールド",
};

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
    if (!(ver in versionDisplayNames)) continue;

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

  interface VersionPair { version: string; en: string; ja: string }
  const pairs: VersionPair[] = [];

  for (const [ver, texts] of byVersion) {
    const ja = texts.ja || texts.jaHrkt;
    if (!texts.en || !ja) continue;
    pairs.push({ version: ver, en: texts.en, ja });
  }

  const orderIndex = new Map(versionOrder.map((v, i) => [v, i]));
  pairs.sort((a, b) => {
    // versionDisplayNames と versionOrder は同じ version 集合を二重管理している。
    // 片方に追加し忘れると並び順が壊れるため、未登録を検知して早期に失敗させる。
    const aIdx = orderIndex.get(a.version);
    const bIdx = orderIndex.get(b.version);
    if (aIdx === undefined || bIdx === undefined) {
      throw new Error(`version not registered in versionOrder: ${a.version} or ${b.version}`);
    }
    return aIdx - bIdx;
  });

  const result: FlavorTextPair[] = [];
  for (const p of pairs) {
    const displayName = versionDisplayNames[p.version];
    const existing = result.find(
      (r) => r.description_en === p.en && r.description_ja === p.ja,
    );
    if (existing) {
      if (!existing.version_names.includes(displayName)) {
        existing.version_names.push(displayName);
      }
    } else {
      result.push({
        version_names: [displayName],
        description_en: p.en,
        description_ja: p.ja,
      });
    }
  }

  return result;
}
