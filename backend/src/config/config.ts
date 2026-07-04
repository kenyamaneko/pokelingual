import "dotenv/config";
import { parseAppEnvironment, type AppEnvironment } from "../domain/environment.js";

/** アプリの動作モード。mock は外部 API をモックに差し替え、real は実サービスに接続する。 */
export type AppMode = "mock" | "real";

const APP_MODES: readonly AppMode[] = ["mock", "real"];

/** アプリ全体の設定値。loadConfig で環境変数から構築する。 */
export interface Config {
  appMode: AppMode;
  /** 実行環境。開発者除外の適用判定に使う。 */
  environment: AppEnvironment;
  port: string;
  googleCloudProject: string;
  googleCloudLocation: string;
  frontendURL: string;
  geminiModel: string;
  perUserDailyLimit: number;
  globalDailyLimit: number;
}

/** mock モード時に許容するデフォルト値。real モードでは必須 env が未設定なら起動エラーにする。 */
const MOCK_DEFAULTS = {
  // 素の npm run dev (PORT 未指定) を compose と同じ 151xx 帯へ載せ、汎用ポートの衝突を避ける (docs/adr/013)
  port: "15100",
  // Firestore Emulator は projectId が非空であることを要求する。本番プロジェクトと混同しないよう専用名にする
  googleCloudProject: "pokelingual-mock",
  googleCloudLocation: "us-central1",
  // CORS 許可オリジン。frontend の素起動も 151xx 帯に統一している (docs/adr/013)
  frontendURL: "http://localhost:15151",
  // mock モードでは GeminiClient を構築しないため参照されない (Config の形を揃えるためだけの値)
  geminiModel: "gemini-2.5-flash",
  perUserDailyLimit: 30,
  globalDailyLimit: 1500,
} as const;

/**
 * 環境変数を取得する。空文字は未設定として扱う。
 * @param key 環境変数名。
 * @returns 値。未設定または空文字なら undefined。
 */
function getEnv(key: string): string | undefined {
  const v = process.env[key];
  // 空文字を未設定と同一視。空文字をホワイトリスト等に流すと意図しない挙動になるため
  return v === undefined || v === "" ? undefined : v;
}

/**
 * 環境変数を正の整数として取得する。
 * @param key 環境変数名。
 * @returns 整数値。未設定なら undefined。
 * @throws 値が正の整数でない場合。
 */
function getIntEnv(key: string): number | undefined {
  const v = getEnv(key);
  if (v === undefined) return undefined;
  const n = parseInt(v, 10);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`invalid env: ${key}=${v} (must be a positive integer)`);
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
 * 必須の環境変数を正の整数として取得する。
 * @param key 環境変数名。
 * @returns 整数値。
 * @throws 未設定、または正の整数でない場合。
 */
function requireIntEnv(key: string): number {
  const v = getIntEnv(key);
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
 * 環境変数から Config を構築する。APP_MODE は常に必須。real モードでは必須 env
 * (APP_ENV, GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION, FRONTEND_URL, GEMINI_MODEL,
 * PER_USER_DAILY_LIMIT, GLOBAL_DAILY_LIMIT) が未設定なら起動エラー。
 * @returns アプリ全体の設定値。
 */
export function loadConfig(): Config {
  const appMode = requireAppMode();
  const isMock = appMode === "mock";

  return {
    appMode,
    environment: parseAppEnvironment(isMock ? (getEnv("APP_ENV") ?? "local") : requireEnv("APP_ENV")),
    port: getEnv("PORT") ?? MOCK_DEFAULTS.port,
    googleCloudProject: isMock ? (getEnv("GOOGLE_CLOUD_PROJECT") ?? MOCK_DEFAULTS.googleCloudProject) : requireEnv("GOOGLE_CLOUD_PROJECT"),
    googleCloudLocation: isMock ? (getEnv("GOOGLE_CLOUD_LOCATION") ?? MOCK_DEFAULTS.googleCloudLocation) : requireEnv("GOOGLE_CLOUD_LOCATION"),
    frontendURL: isMock ? (getEnv("FRONTEND_URL") ?? MOCK_DEFAULTS.frontendURL) : requireEnv("FRONTEND_URL"),
    geminiModel: isMock ? (getEnv("GEMINI_MODEL") ?? MOCK_DEFAULTS.geminiModel) : requireEnv("GEMINI_MODEL"),
    perUserDailyLimit: isMock ? (getIntEnv("PER_USER_DAILY_LIMIT") ?? MOCK_DEFAULTS.perUserDailyLimit) : requireIntEnv("PER_USER_DAILY_LIMIT"),
    globalDailyLimit: isMock ? (getIntEnv("GLOBAL_DAILY_LIMIT") ?? MOCK_DEFAULTS.globalDailyLimit) : requireIntEnv("GLOBAL_DAILY_LIMIT"),
  };
}
