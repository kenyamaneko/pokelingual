import type { QuestNewResponse, ScoreResponse, CaptureResponse } from "../../../shared/api-types/quest";
import { officialArtworkURL } from "./pokemonSprites";

const TUTORIAL_POKEMON_ID = 25;
const TUTORIAL_DESCRIPTION_EN = "It is an Electric-type Mouse Pokémon.";
const TUTORIAL_DESCRIPTION_JA = "電気タイプのねずみポケモン";
const TUTORIAL_SCORE = 100;
const TUTORIAL_SPRITE_URL = officialArtworkURL(TUTORIAL_POKEMON_ID);
const TUTORIAL_BASE_STAT_TOTAL = 320;

/** チュートリアル専用の固定出題データ。 */
export const TUTORIAL_QUEST: QuestNewResponse = {
  pokemon_id: TUTORIAL_POKEMON_ID,
  description_en: TUTORIAL_DESCRIPTION_EN,
  is_legendary: false,
  is_mythical: false,
};

/** チュートリアル専用の固定採点結果 (常に満点)。 */
export const TUTORIAL_SCORE_RESULT: ScoreResponse = {
  score: TUTORIAL_SCORE,
  review: "かんぺきな　ほんやくだ！",
  description_ja: TUTORIAL_DESCRIPTION_JA,
};

/** チュートリアル専用の固定捕獲結果 (常に捕獲成功)。 */
export const TUTORIAL_CAPTURE_RESULT: CaptureResponse = {
  captured: true,
  probability: 1,
  pokemon_id: TUTORIAL_POKEMON_ID,
  name_en: "Pikachu",
  name_ja: "ピカチュウ",
  sprite_url: TUTORIAL_SPRITE_URL,
  score: TUTORIAL_SCORE,
  description_en: TUTORIAL_DESCRIPTION_EN,
  description_ja: TUTORIAL_DESCRIPTION_JA,
  base_stat_total: TUTORIAL_BASE_STAT_TOTAL,
  ball_type: "poke",
  types: ["electric"],
  height: 4,
  weight: 60,
  is_legendary: false,
  is_mythical: false,
};
