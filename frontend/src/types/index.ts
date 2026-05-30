/** /quest/new のレスポンス。マスク済み英語説明文を含む。 */
export interface QuestNewResponse {
  pokemon_id: number;
  description_en: string;
  is_legendary: boolean;
  is_mythical: boolean;
}

/** /quest/score のレスポンス。スコア・講評・日本語説明 (マスク済み) を含む。 */
export interface ScoreResponse {
  score: number;
  review: string;
  description_ja: string;
}

/** /quest/guess-name のレスポンス。正解時はボール種別、不正解時は残試行を返す。 */
export interface GuessResponse {
  correct: boolean;
  ball_type?: string;
  language?: string;
  fuzzy?: boolean;
  attempts_remaining: number;
  reveal_name_en?: string;
  reveal_name_ja?: string;
}

/** /quest/capture のレスポンス。捕獲成否と表示用のポケモン情報を含む。 */
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
  base_stat_total: number;
  ball_type: string;
  types?: string[];
  height?: number;
  weight?: number;
  is_legendary: boolean;
  is_mythical: boolean;
}

/** チャットの 1 発言。 */
export interface ChatMessage {
  role: "user" | "professor";
  content: string;
}

/** /quest/chat に渡すクエスト文脈。 */
export interface ChatContext {
  description_en: string;
  description_ja: string;
  translation: string;
  score: number;
  review: string;
  name_en: string;
  name_ja: string;
}

/** /quest/chat のレスポンス。 */
export interface ChatResponse {
  reply: string;
}

/** 図鑑一覧の 1 エントリ。 */
export interface CollectionEntry {
  pokemon_id: number;
  name_en: string;
  name_ja: string;
  sprite_url: string;
  status: string;
  total_captures: number;
  best_score: number;
}

/** 図鑑説明文の英日ペア。複数バージョンをまとめる。 */
export interface FlavorTextPair {
  version_names: string[];
  description_en: string;
  description_ja: string;
}

/** /collection/:id のレスポンス。ユーザ実績と PokeAPI の詳細情報を合成した形。 */
export interface PokemonDetail {
  pokemon_id: number;
  status: string;
  total_captures: number;
  total_encounters: number;
  last_captured_at: string | null;
  last_encountered_at: string;
  best_score: number;
  name_en: string;
  name_ja: string;
  description_en: string;
  description_ja: string;
  sprite_url: string;
  types?: string[];
  height?: number;
  weight?: number;
  flavor_texts?: FlavorTextPair[];
}
