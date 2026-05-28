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

function getEnv(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

function getIntEnv(key: string, fallback: number): number {
  const v = process.env[key];
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** 環境変数から Config を構築する。未設定値はデフォルトを使う。 */
export function loadConfig(): Config {
  return {
    appMode: getEnv("APP_MODE", "mock"),
    port: getEnv("PORT", "8080"),
    gcpProject: getEnv("GCP_PROJECT", ""),
    gcpLocation: getEnv("GCP_LOCATION", "us-central1"),
    frontendURL: getEnv("FRONTEND_URL", "http://localhost:5173"),
    perUserDailyLimit: getIntEnv("PER_USER_DAILY_LIMIT", 30),
    globalDailyLimit: getIntEnv("GLOBAL_DAILY_LIMIT", 1500),
  };
}
