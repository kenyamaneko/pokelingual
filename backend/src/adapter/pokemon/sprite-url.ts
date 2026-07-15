// 画像は jsDelivr (GitHub 公開リポ向け CDN) から配信する。ブランチではなくコミットに固定し、
// 同一 URL を immutable キャッシュで長期配信させ、GitHub raw のレート制限を避ける (ADR-022 / BDR-007)。
const SPRITE_SOURCE_REF = "bf4c47ac82c33b330e33d98b8882d1cedb2f53e7";

const OFFICIAL_ARTWORK_BASE_URL = `https://cdn.jsdelivr.net/gh/PokeAPI/sprites@${SPRITE_SOURCE_REF}/sprites/pokemon/other/official-artwork`;

/**
 * 図鑑番号からポケモンの公式アートワーク画像 URL を組み立てる。
 * @param id 図鑑番号。
 * @returns 画像 URL。
 */
export function buildSpriteURL(id: number): string {
  return `${OFFICIAL_ARTWORK_BASE_URL}/${id}.png`;
}
