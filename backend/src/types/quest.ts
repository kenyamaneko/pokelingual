/** 進行中のクエストセッション。出題から捕獲までの状態を保持する。 */
export interface QuestSession {
  pokemon_id: number;
  description_en: string;
  description_ja: string;
  name_en: string;
  name_ja: string;
  sprite_url: string;
  base_stat_total: number;
  types: string[];
  height: number;
  weight: number;
  is_legendary: boolean;
  is_mythical: boolean;
  score: number;
  ball_type: string;
  guess_attempts: number;
  name_guessed: boolean;
}

/** AIScorer.scoreTranslation の戻り値。 */
export interface ScoreResult {
  score: number;
  review: string;
}

/** チャットの 1 発言。 */
export interface ChatMessage {
  role: "user" | "professor";
  content: string;
}

/** オーキド博士チャットに与えるクエスト文脈。 */
export interface ChatContext {
  description_en: string;
  description_ja: string;
  translation: string;
  score: number;
  review: string;
  name_en: string;
  name_ja: string;
}
