// 画像は jsDelivr (GitHub 公開リポ向け CDN) から配信する。ブランチではなくコミットに固定し、
// 同一 URL を immutable キャッシュで長期配信させ、GitHub raw のレート制限を避ける。
const SPRITE_SOURCE_REF = "bf4c47ac82c33b330e33d98b8882d1cedb2f53e7";

const SPRITES_BASE_URL = `https://cdn.jsdelivr.net/gh/PokeAPI/sprites@${SPRITE_SOURCE_REF}/sprites`;

/**
 * アイテム画像 (ボール等) の URL を組み立てる。
 * @param name アイテムのスプライト名 (例: "poke-ball")。
 * @returns 画像 URL。
 */
export function itemSpriteURL(name: string): string {
  return `${SPRITES_BASE_URL}/items/${name}.png`;
}

/** モンスターボール画像の URL。各ページのロゴに使う。 */
export const POKE_BALL_SPRITE_URL = itemSpriteURL("poke-ball");

/**
 * ポケモンの公式アートワーク画像の URL を図鑑番号から組み立てる。
 * @param id 図鑑番号。
 * @returns 画像 URL。
 */
export function officialArtworkURL(id: number): string {
  return `${SPRITES_BASE_URL}/pokemon/other/official-artwork/${id}.png`;
}
