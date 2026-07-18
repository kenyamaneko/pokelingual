import type { BallType } from "../../../../shared/api-types/quest";
import { itemSpriteURL } from "../../utils/pokemonSprites";

/** ボール種別ごとのスプライト画像 URL。 */
export const BALL_SPRITES: Record<BallType, string> = {
  poke: itemSpriteURL("poke-ball"),
  great: itemSpriteURL("great-ball"),
  ultra: itemSpriteURL("ultra-ball"),
  master: itemSpriteURL("master-ball"),
};

/** ボール種別ごとの表示名。 */
export const BALL_NAMES: Record<BallType, string> = {
  poke: "モンスターボール",
  great: "スーパーボール",
  ultra: "ハイパーボール",
  master: "マスターボール",
};

/**
 * ボール種別に対応する使用ボタンの文言。
 * @param ballType ボール種別。
 * @returns 使用ボタンの表示文言。
 */
export function captureUseButtonLabel(ballType: BallType): string {
  return `${BALL_NAMES[ballType]}を　使う`;
}
