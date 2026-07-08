/**
 * Pokelingual のクエスト関連 API 契約型。
 * バックエンド (Express ハンドラ/サービス) とフロントエンド (API クライアント) の両方が import type する。
 * このファイルが SSOT。バックエンド/フロントエンドで定義を二重持ちしないこと。
 */
import type { PokemonType } from "./pokemon.js";

/** 捕獲に使うボール種別。 */
export type BallType = "poke" | "great" | "ultra";

/** クエストの探索場所。選んだ場所のタイプのポケモンが出題される (幻・伝説は場所によらず低確率で出る)。 */
export interface QuestLocation {
  id: string;
  name: string;
  description: string;
  types: PokemonType[];
}

/** GET /api/quest/locations のレスポンス。場所選択に提示する候補 (全体からランダムに数か所)。 */
export interface QuestLocationsResponse {
  locations: QuestLocation[];
}

/**
 * GET /api/quest/new のレスポンス。ポケモン名は説明文から伏せ字化されている。
 * クエリ `?location=<id>` で探索場所を指定でき、その場所のタイプに出題を絞る (省略時はタイプ非限定)。
 */
export interface QuestNewResponse {
  pokemon_id: number;
  description_en: string;
  is_legendary: boolean;
  is_mythical: boolean;
}

/** POST /api/quest/score のレスポンス。スコア・講評・日本語版説明 (マスク済み) を含む。 */
export interface ScoreResponse {
  score: number;
  review: string;
  description_ja: string;
}

/** POST /api/quest/guess-name のレスポンス。正解時はボール種別、不正解時は残り試行回数を返す。 */
export interface GuessResponse {
  correct: boolean;
  ball_type?: BallType;
  language?: "en" | "ja";
  fuzzy?: boolean;
  attempts_remaining: number;
  reveal_name_en?: string;
  reveal_name_ja?: string;
}

/** POST /api/quest/skip-guess のレスポンス。スキップ時は常にモンスターボール。 */
export interface SkipGuessResponse {
  ball_type: BallType;
}

/** POST /api/quest/capture のレスポンス。捕獲成否と表示用のポケモン情報を含む。 */
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
  ball_type: BallType;
  types: PokemonType[];
  height: number;
  weight: number;
  is_legendary: boolean;
  is_mythical: boolean;
}
