import dotenv from "dotenv";
import { MAX_FINAL_SCORE } from "../service/quest-service.js";
import type { BallType } from "../../../shared/api-types/quest.js";

// dotenv は既に process.env にある値を上書きしないため、配列の先頭ほど優先される。
// .env (開発者ローカルの秘密情報。gitignore 対象) を .env.tuning (チェックイン済みの既定値) より優先する。
dotenv.config({ path: [".env", ".env.tuning"] });

/** アプリの動作モード。mock は外部 API をモックに差し替え、real は実サービスに接続する。 */
export type AppMode = "mock" | "real";

const APP_MODES: readonly AppMode[] = ["mock", "real"];

/** アプリ全体の設定値。loadConfig で環境変数から構築する。 */
export interface Config {
  appMode: AppMode;
  port: string;
  googleCloudProject: string;
  googleCloudLocation: string;
  frontendURL: string;
  geminiModel: string;
  perUserDailyLimit: number;
  globalDailyLimit: number;
  /** ポケモン種別データのスナップショットの読み込み元。`gs://` なら Cloud Storage、それ以外はローカルパス。 */
  pokemonSnapshotURI: string;
  /** クエストセッションストアの接続 URL。mock はローカル Valkey、real は Upstash Redis へ。 */
  questSessionRedisURL: string;
  /** クエストセッションの有効期限 (秒)。ストアへの set のたびに再適用する。 */
  questSessionTTLSeconds: number;
  /** Levenshtein あいまい一致を有効化する英語名の最小文字数。短い名前は誤検出が増えるため除外。 */
  fuzzyMatchMinNameLength: number;
  /** Levenshtein 距離がこの値以下なら正解扱い (タイプミス許容)。 */
  fuzzyMatchMaxDistance: number;
  /** ボール種別ごとの捕獲確率ボーナス (ロジットへの加算値)。master は確率計算をバイパスするため対象外。 */
  ballCaptureBonus: Record<Exclude<BallType, "master">, number>;
  /** 幻・伝説を抽選する確率 (場所によらず低確率で登場させる)。乱数の上位この割合が当たり。 */
  legendaryEncounterRate: number;
  /** 場所選択に一度に提示する場所の数。 */
  locationChoiceCount: number;
  /** 伝説・幻ポケモンをマスターボールで確定捕獲するために必要な最終評価点の下限。 */
  masterBallMinScore: number;
  /** ユーザが除外指定できるポケモン数の上限。 */
  maxExcludedPokemonCount: number;
}

/** mock モード時に許容するデフォルト値。real モードでは必須 env が未設定なら起動エラーにする。 */
const MOCK_DEFAULTS = {
  // 素の npm run dev (PORT 未指定) を compose と同じ 151xx 帯へ載せ、汎用ポートの衝突を避ける (docs/adr/023)
  port: "15100",
  // Firestore Emulator は projectId が非空であることを要求する。本番プロジェクトと混同しないよう専用名にする
  googleCloudProject: "pokelingual-mock",
  googleCloudLocation: "us-central1",
  // CORS 許可オリジン。frontend の素起動も 151xx 帯に統一している (docs/adr/023)
  frontendURL: "http://localhost:15151",
  // mock モードでは GeminiClient を構築しないため参照されない (Config の形を揃えるためだけの値)
  geminiModel: "gemini-2.5-flash",
  perUserDailyLimit: 30,
  globalDailyLimit: 1500,
  // docker-compose.dev.yml の valkey サービス名を指す
  questSessionRedisURL: "redis://valkey:6379",
  questSessionTTLSeconds: 3600,
} as const;

/**
 * 環境変数を取得する。空文字は未設定として扱う。
 * @param key 環境変数名。
 * @returns 値。未設定または空文字なら undefined。
 */
function getEnv(key: string): string | undefined {
  const v = process.env[key];
  // 空文字・空白のみを未設定と同一視。Number(" ") が 0 になるなど、空相当の値が意図しない形で通るため
  return v === undefined || v.trim() === "" ? undefined : v;
}

/**
 * 環境変数を整数として取得する。
 * @param key 環境変数名。
 * @param min 許容する最小値 (含む)。既定は1 (正の整数)。
 * @param max 許容する最大値 (含む)。既定は上限なし。
 * @returns 整数値。未設定なら undefined。
 * @throws 値が整数でない、または範囲外の場合。
 */
function getIntEnv(key: string, min = 1, max = Infinity): number | undefined {
  const v = getEnv(key);
  if (v === undefined) return undefined;
  // parseInt は "1.5" → 1, "4abc" → 4 のように末尾の余剰文字を黙って切り捨てるため使わない。
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new Error(`invalid env: ${key}=${v} (must be an integer between ${min} and ${max})`);
  }
  return n;
}

/**
 * 環境変数を浮動小数点数として取得する。
 * @param key 環境変数名。
 * @param min 許容する最小値 (含む)。
 * @param max 許容する最大値 (含む)。既定は上限なし。
 * @returns 数値。未設定なら undefined。
 * @throws 値が数値でない、または範囲外の場合。
 */
function getFloatEnv(key: string, min: number, max = Infinity): number | undefined {
  const v = getEnv(key);
  if (v === undefined) return undefined;
  // parseFloat は "1.5abc" → 1.5 のように末尾の余剰文字を黙って切り捨てるため使わない。
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new Error(`invalid env: ${key}=${v} (must be a number between ${min} and ${max})`);
  }
  return n;
}

/**
 * 必須の環境変数を取得する。
 * @param key 環境変数名。
 * @returns 値。
 * @throws 未設定の場合。
 */
function requireEnv(key: string): string {
  const v = getEnv(key);
  if (v === undefined) throw new Error(`required env not set: ${key}`);
  return v;
}

/**
 * 必須の環境変数を整数として取得する。
 * @param key 環境変数名。
 * @param min 許容する最小値 (含む)。既定は1 (正の整数)。
 * @param max 許容する最大値 (含む)。既定は上限なし。
 * @returns 整数値。
 * @throws 未設定、または整数として不正な場合。
 */
function requireIntEnv(key: string, min = 1, max = Infinity): number {
  const v = getIntEnv(key, min, max);
  if (v === undefined) throw new Error(`required env not set: ${key}`);
  return v;
}

/**
 * 必須の環境変数を浮動小数点数として取得する。
 * @param key 環境変数名。
 * @param min 許容する最小値 (含む)。
 * @param max 許容する最大値 (含む)。既定は上限なし。
 * @returns 数値。
 * @throws 未設定、または数値として不正な場合。
 */
function requireFloatEnv(key: string, min: number, max = Infinity): number {
  const v = getFloatEnv(key, min, max);
  if (v === undefined) throw new Error(`required env not set: ${key}`);
  return v;
}

/**
 * APP_MODE を取得し、定義済みモードであることを検証する。
 * @returns 検証済みのアプリ動作モード。
 * @throws 未設定、または未知のモードの場合。
 */
function requireAppMode(): AppMode {
  const v = requireEnv("APP_MODE");
  // 未知値を real 扱いなどに倒すと意図しないモードで起動しうるため、ここで失敗させる
  if (!APP_MODES.includes(v as AppMode)) {
    throw new Error(`invalid env: APP_MODE=${v} (must be "mock" or "real")`);
  }
  return v as AppMode;
}

/**
 * 環境変数から Config を構築する。APP_MODE は常に必須。real モードでは追加の必須 env
 * (GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION, FRONTEND_URL, GEMINI_MODEL,
 * PER_USER_DAILY_LIMIT, GLOBAL_DAILY_LIMIT, POKEMON_SNAPSHOT_URI, UPSTASH_REDIS_URL,
 * QUEST_SESSION_TTL_SECONDS) が未設定なら起動エラー。チューニングパラメーター
 * (FUZZY_MATCH_MIN_NAME_LENGTH 等、.env.tuning が供給する9値) はモード問わず必須。
 * @returns アプリ全体の設定値。
 */
export function loadConfig(): Config {
  const appMode = requireAppMode();
  const isMock = appMode === "mock";

  return {
    appMode,
    port: getEnv("PORT") ?? MOCK_DEFAULTS.port,
    googleCloudProject: isMock ? (getEnv("GOOGLE_CLOUD_PROJECT") ?? MOCK_DEFAULTS.googleCloudProject) : requireEnv("GOOGLE_CLOUD_PROJECT"),
    googleCloudLocation: isMock ? (getEnv("GOOGLE_CLOUD_LOCATION") ?? MOCK_DEFAULTS.googleCloudLocation) : requireEnv("GOOGLE_CLOUD_LOCATION"),
    frontendURL: isMock ? (getEnv("FRONTEND_URL") ?? MOCK_DEFAULTS.frontendURL) : requireEnv("FRONTEND_URL"),
    geminiModel: isMock ? (getEnv("GEMINI_MODEL") ?? MOCK_DEFAULTS.geminiModel) : requireEnv("GEMINI_MODEL"),
    perUserDailyLimit: isMock ? (getIntEnv("PER_USER_DAILY_LIMIT") ?? MOCK_DEFAULTS.perUserDailyLimit) : requireIntEnv("PER_USER_DAILY_LIMIT"),
    globalDailyLimit: isMock ? (getIntEnv("GLOBAL_DAILY_LIMIT") ?? MOCK_DEFAULTS.globalDailyLimit) : requireIntEnv("GLOBAL_DAILY_LIMIT"),
    // mock モードでは MockPokemonClient を使うため参照されない (Config の形を揃えるためだけの値)
    pokemonSnapshotURI: isMock ? (getEnv("POKEMON_SNAPSHOT_URI") ?? "") : requireEnv("POKEMON_SNAPSHOT_URI"),
    questSessionRedisURL: isMock
      ? (getEnv("UPSTASH_REDIS_URL") ?? MOCK_DEFAULTS.questSessionRedisURL)
      : requireEnv("UPSTASH_REDIS_URL"),
    questSessionTTLSeconds: isMock
      ? (getIntEnv("QUEST_SESSION_TTL_SECONDS") ?? MOCK_DEFAULTS.questSessionTTLSeconds)
      : requireIntEnv("QUEST_SESSION_TTL_SECONDS"),
    // チューニングパラメーターは .env.tuning が mock/real 共通で供給するため、モードで分岐しない。
    fuzzyMatchMinNameLength: requireIntEnv("FUZZY_MATCH_MIN_NAME_LENGTH"),
    fuzzyMatchMaxDistance: requireIntEnv("FUZZY_MATCH_MAX_DISTANCE"),
    ballCaptureBonus: {
      poke: requireFloatEnv("BALL_CAPTURE_BONUS_POKE", 0),
      great: requireFloatEnv("BALL_CAPTURE_BONUS_GREAT", 0),
      ultra: requireFloatEnv("BALL_CAPTURE_BONUS_ULTRA", 0),
    },
    legendaryEncounterRate: requireFloatEnv("LEGENDARY_ENCOUNTER_RATE", 0, 1),
    locationChoiceCount: requireIntEnv("LOCATION_CHOICE_COUNT"),
    masterBallMinScore: requireIntEnv("MASTER_BALL_MIN_SCORE", 0, MAX_FINAL_SCORE),
    maxExcludedPokemonCount: requireIntEnv("MAX_EXCLUDED_POKEMON_COUNT"),
  };
}
