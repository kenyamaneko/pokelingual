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

export interface ScoreResult {
  score: number;
  review: string;
}

export interface ChatMessage {
  role: "user" | "professor";
  content: string;
}

export interface ChatContext {
  description_en: string;
  description_ja: string;
  translation: string;
  score: number;
  review: string;
  name_en: string;
  name_ja: string;
}
