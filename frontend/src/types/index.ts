export interface QuestNewResponse {
  pokemon_id: number;
  description_en: string;
}

export interface ScoreResponse {
  score: number;
  review: string;
  description_ja: string;
}

export interface GuessResponse {
  correct: boolean;
  multiplier?: number;
  language?: string;
  fuzzy?: boolean;
  attempts_remaining: number;
  reveal_name_en?: string;
  reveal_name_ja?: string;
}

export interface CaptureResponse {
  captured: boolean;
  probability: number;
  pokemon_id: number;
  name_en: string;
  name_ja: string;
  sprite_url: string;
  score: number;
  description_en: string;
  description_ja: string;
}

export interface CollectionEntry {
  pokemon_id: number;
  name_en: string;
  name_ja: string;
  sprite_url: string;
  status: string;
  total_captures: number;
  best_score: number;
}

export interface FlavorTextPair {
  version_names: string[];
  description_en: string;
  description_ja: string;
}

export interface PokemonDetail {
  pokemon_id: number;
  status: string;
  total_captures: number;
  total_encounters: number;
  last_captured_at: string;
  last_encountered_at: string;
  best_score: number;
  name_en: string;
  name_ja: string;
  description_en: string;
  description_ja: string;
  sprite_url: string;
  flavor_texts?: FlavorTextPair[];
}
