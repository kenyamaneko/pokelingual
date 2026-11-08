import type { BallType } from "../../../../shared/api-types/quest";
import { buildItemSpriteURL } from "../../utils/pokemonSprites";

/** ボール種別ごとのスプライト画像 URL。 */
export const BALL_SPRITES: Record<BallType, string> = {
  poke: buildItemSpriteURL("poke-ball"),
  great: buildItemSpriteURL("great-ball"),
  ultra: buildItemSpriteURL("ultra-ball"),
  master: buildItemSpriteURL("master-ball"),
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
export function getCaptureUseButtonLabel(ballType: BallType): string {
  return `${BALL_NAMES[ballType]}を　使う`;
}
