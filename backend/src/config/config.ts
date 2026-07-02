import "dotenv/config";

/** アプリ全体の設定値。loadConfig で環境変数から構築する。 */
export interface Config {
  appMode: string;
  port: string;
  googleCloudProject: string;
  googleCloudLocation: string;
  frontendURL: string;
  perUserDailyLimit: number;
  globalDailyLimit: number;
}

/** mock モード時に許容するデフォルト値。本番モードでは必須 env が未設定なら起動エラーにする。 */
const MOCK_DEFAULTS = {
  port: "8080",
  // Firestore Emulator は projectId が非空であることを要求する。本番プロジェクトと混同しないよう専用名にする
  googleCloudProject: "pokelingual-mock",
  googleCloudLocation: "us-central1",
  frontendURL: "http://localhost:5173",
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
 * 環境変数から Config を構築する。本番モードでは必須 env (GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION,
 * FRONTEND_URL, PER_USER_DAILY_LIMIT, GLOBAL_DAILY_LIMIT) が未設定なら起動エラー。
 * @returns アプリ全体の設定値。
 */
export function loadConfig(): Config {
  const appMode = getEnv("APP_MODE") ?? "mock";
  const isMock = appMode === "mock";

  return {
    appMode,
    port: getEnv("PORT") ?? MOCK_DEFAULTS.port,
    googleCloudProject: isMock ? (getEnv("GOOGLE_CLOUD_PROJECT") ?? MOCK_DEFAULTS.googleCloudProject) : requireEnv("GOOGLE_CLOUD_PROJECT"),
    googleCloudLocation: isMock ? (getEnv("GOOGLE_CLOUD_LOCATION") ?? MOCK_DEFAULTS.googleCloudLocation) : requireEnv("GOOGLE_CLOUD_LOCATION"),
    frontendURL: isMock ? (getEnv("FRONTEND_URL") ?? MOCK_DEFAULTS.frontendURL) : requireEnv("FRONTEND_URL"),
    perUserDailyLimit: isMock ? (getIntEnv("PER_USER_DAILY_LIMIT") ?? MOCK_DEFAULTS.perUserDailyLimit) : requireIntEnv("PER_USER_DAILY_LIMIT"),
    globalDailyLimit: isMock ? (getIntEnv("GLOBAL_DAILY_LIMIT") ?? MOCK_DEFAULTS.globalDailyLimit) : requireIntEnv("GLOBAL_DAILY_LIMIT"),
  };
}
