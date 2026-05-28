import type {
  ScoreResult,
  ChatContext,
  ChatMessage,
  Pokemon,
  UserPokemon,
  UserSettings,
} from "../types/index.js";

/** 翻訳採点と教授チャットを担う AI スコアラ。GeminiService と MockAIScorer が実装する。 */
export interface AIScorer {
  scoreTranslation(englishText: string, japaneseTranslation: string): Promise<ScoreResult>;
  replyToChat(chatCtx: ChatContext, messages: ChatMessage[]): Promise<string>;
}

/** ポケモン情報の取得を担うフェッチャ。PokeAPIService と MockPokemonFetcher が実装する。 */
export interface PokemonFetcher {
  getRandomPokemon(): Promise<Pokemon>;
  getPokemonByID(id: number): Promise<Pokemon>;
}

/** ユーザの図鑑進捗 (遭遇/捕獲) を永続化するリポジトリ。 */
export interface UserPokemonRepository {
  upsertEncounter(uid: string, pokemonID: number, score: number, captured: boolean): Promise<void>;
  getCollection(uid: string): Promise<UserPokemon[]>;
  getPokemon(uid: string, pokemonID: number): Promise<UserPokemon>;
}

/** ユーザ設定 (除外ポケモン等) を永続化するリポジトリ。 */
export interface UserSettingsRepository {
  getSettings(uid: string): Promise<UserSettings>;
  updateExcludedPokemon(uid: string, pokemonIDs: number[]): Promise<void>;
}

/** 当日のレートリミット利用状況。count が消費数、limit が上限値。 */
export interface DailyUsage {
  count: number;
  limit: number;
}

/** 日次レート制限カウンタを管理するリポジトリ。Firestore 版とインメモリ版がある。 */
export interface RateLimitRepository {
  checkAndIncrement(uid: string): Promise<DailyUsage>;
  getUserUsage(uid: string): Promise<DailyUsage>;
}
