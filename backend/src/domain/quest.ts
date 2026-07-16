import type { PokemonType } from "../../../shared/api-types/pokemon.js";
import type { BallType } from "../../../shared/api-types/quest.js";

/** 進行中のクエストセッション。出題から捕獲までの状態を保持する。 */
export interface QuestSession {
  pokemon_id: number;
  description_en: string;
  description_ja: string;
  name_en: string;
  name_ja: string;
  sprite_url: string;
  base_stat_total: number;
  types: PokemonType[];
  height: number;
  weight: number;
  is_legendary: boolean;
  is_mythical: boolean;
  score: number;
  /** 確定したボール種別。名前当て/スキップ前は null。 */
  ball_type: BallType | null;
  guess_attempts: number;
  name_guessed: boolean;
  hint_used: boolean;
}

/** 翻訳採点結果。スコアと講評文 (LLM が直接返す内部表現)。 */
export interface ScoreResult {
  score: number;
  review: string;
}
