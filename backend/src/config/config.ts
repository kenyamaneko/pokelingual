import "dotenv/config";

/** アプリ全体の設定値。loadConfig で環境変数から構築する。 */
export interface Config {
  appMode: string;
  port: string;
  gcpProject: string;
  gcpLocation: string;
  frontendURL: string;
  perUserDailyLimit: number;
  globalDailyLimit: number;
}

/** mock モード時に許容するデフォルト値。本番モードでは必須 env が未設定なら起動エラーにする。 */
const MOCK_DEFAULTS = {
  port: "8080",
  gcpProject: "",
  gcpLocation: "us-central1",
  frontendURL: "http://localhost:5173",
  perUserDailyLimit: 30,
  globalDailyLimit: 1500,
} as const;

function getEnv(key: string): string | undefined {
  const v = process.env[key];
  // 空文字を未設定と同一視。空文字をホワイトリスト等に流すと意図しない挙動になるため
  return v === undefined || v === "" ? undefined : v;
}

function getIntEnv(key: string): number | undefined {
  const v = getEnv(key);
  if (v === undefined) return undefined;
  const n = parseInt(v, 10);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`invalid env: ${key}=${v} (must be a positive integer)`);
  }
  return n;
}

function requireEnv(key: string): string {
  const v = getEnv(key);
  if (v === undefined) throw new Error(`required env not set: ${key}`);
  return v;
}

/** 環境変数から Config を構築する。本番モードでは必須 env (GCP_PROJECT, FRONTEND_URL) が未設定なら起動エラー。 */
export function loadConfig(): Config {
  const appMode = getEnv("APP_MODE") ?? "mock";
  const isMock = appMode === "mock";

  return {
    appMode,
    port: getEnv("PORT") ?? MOCK_DEFAULTS.port,
    gcpProject: isMock ? (getEnv("GCP_PROJECT") ?? MOCK_DEFAULTS.gcpProject) : requireEnv("GCP_PROJECT"),
    gcpLocation: getEnv("GCP_LOCATION") ?? MOCK_DEFAULTS.gcpLocation,
    frontendURL: isMock ? (getEnv("FRONTEND_URL") ?? MOCK_DEFAULTS.frontendURL) : requireEnv("FRONTEND_URL"),
    perUserDailyLimit: getIntEnv("PER_USER_DAILY_LIMIT") ?? MOCK_DEFAULTS.perUserDailyLimit,
    globalDailyLimit: getIntEnv("GLOBAL_DAILY_LIMIT") ?? MOCK_DEFAULTS.globalDailyLimit,
  };
}
