import "dotenv/config";

export interface Config {
  appMode: string;
  port: string;
  gcpProject: string;
  gcpLocation: string;
  frontendURL: string;
}

function getEnv(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

export function loadConfig(): Config {
  return {
    appMode: getEnv("APP_MODE", "mock"),
    port: getEnv("PORT", "8080"),
    gcpProject: getEnv("GCP_PROJECT", ""),
    gcpLocation: getEnv("GCP_LOCATION", "us-central1"),
    frontendURL: getEnv("FRONTEND_URL", "http://localhost:5173"),
  };
}
