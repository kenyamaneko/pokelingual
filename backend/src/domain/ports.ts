import type { Pokemon } from "./pokemon.js";
import type { QuestSession } from "./quest.js";
import type { User, UserPokemon, UserSettings } from "./user.js";
import type { PokemonType } from "../../../shared/api-types/pokemon.js";
// DailyUsage は API レスポンスにそのまま乗る形なので、shared/api-types/usage.d.ts を SSOT として再 export する。
import type { DailyUsage } from "../../../shared/api-types/usage.js";
export type { DailyUsage };

/** プロンプトを投げてテキスト応答を得る LLM ポート。プロンプト組み立てとレスポンス解釈はサービス側で行う。 */
export interface LLMClient {
  generateText(prompt: string): Promise<string>;
}

/** [0,1) の乱数を供給するポート。捕獲抽選などの確率的処理をテスト/mock で決定化するための seam。 */
export interface RandomSource {
  next(): number;
}

/** ポケモン情報の取得を担うデータソースポート。抽選 (どの ID を出すか) はサービス側が行い、実装はデータ提供のみを担う。 */
export interface PokemonClient {
  getPokemonByID(id: number): Promise<Pokemon>;
  /** このデータソースが取得できる図鑑番号の一覧 (mock は固定リスト、real はスナップショットに含まれる番号)。 */
  getServableIDs(): readonly number[];
  /** 指定タイプを持つポケモンの図鑑番号 (このデータソースが扱える範囲内)。場所フィルタで使う。 */
  getIDsByType(type: PokemonType): Promise<readonly number[]>;
}

/** ユーザの図鑑進捗 (遭遇/捕獲) を永続化するリポジトリ。 */
export interface UserPokemonRepository {
  upsertEncounter(userId: string, pokemonID: number, score: number, isCaptured: boolean): Promise<void>;
  getPokedex(userId: string): Promise<UserPokemon[]>;
  getPokemon(userId: string, pokemonID: number): Promise<UserPokemon>;
}

/** ユーザ設定 (除外ポケモン等) を永続化するリポジトリ。 */
export interface UserSettingsRepository {
  getSettings(userId: string): Promise<UserSettings>;
  updateExcludedPokemon(userId: string, pokemonIDs: number[]): Promise<void>;
  updateEnabledGenerations(userId: string, generations: number[]): Promise<void>;
}

/** ユーザ本体 (users/{uid} ルートドキュメント) を永続化するリポジトリ。 */
export interface UserRepository {
  getUser(userId: string): Promise<User>;
  markTutorialCompleted(userId: string): Promise<void>;
}

/** 日次レート制限カウンタを管理するリポジトリ。Firestore 版とインメモリ版がある。 */
export interface RateLimitRepository {
  checkAndIncrement(userId: string): Promise<DailyUsage>;
  getUserUsage(userId: string): Promise<DailyUsage>;
}

/** 進行中のクエストセッションを保存・取得・削除するポート。Redis 実装がある。 */
export interface QuestSessionStore {
  get(userId: string): Promise<QuestSession | null>;
  set(userId: string, session: QuestSession): Promise<void>;
  delete(userId: string): Promise<void>;
}
