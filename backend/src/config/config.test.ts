import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig } from "./config.js";

// loadConfig は process.env を読むため、テストごとに退避・復元する。
const ORIGINAL_ENV = { ...process.env };

/** loadConfig が参照する env を全て消す。 */
function clearConfigEnv(): void {
  for (const key of [
    "APP_MODE",
    "PORT",
    "APP_ENV",
    "GOOGLE_CLOUD_PROJECT",
    "GOOGLE_CLOUD_LOCATION",
    "FRONTEND_URL",
    "GEMINI_MODEL",
    "PER_USER_DAILY_LIMIT",
    "GLOBAL_DAILY_LIMIT",
    "POKEMON_SNAPSHOT_URI",
  ]) {
    delete process.env[key];
  }
}

describe("起動設定の読み込み", () => {
  beforeEach(clearConfigEnv);
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("APP_MODE 未設定は起動エラー (mock への暗黙フォールバックはしない)", () => {
    expect(() => loadConfig()).toThrow(/required env not set: APP_MODE/);
  });

  it("APP_MODE が未知の値なら起動エラー", () => {
    process.env.APP_MODE = "prod";
    expect(() => loadConfig()).toThrow(/invalid env: APP_MODE/);
  });

  it("mock モードでは他の env が未設定でも既定値で起動できる", () => {
    process.env.APP_MODE = "mock";
    const cfg = loadConfig();
    expect(cfg.appMode).toBe("mock");
    expect(cfg.googleCloudProject).toBe("pokelingual-mock");
    expect(cfg.perUserDailyLimit).toBe(30);
    expect(cfg.globalDailyLimit).toBe(1500);
  });

  it("整数 env の 1 は受理される", () => {
    process.env.APP_MODE = "mock";
    process.env.PER_USER_DAILY_LIMIT = "1";
    expect(loadConfig().perUserDailyLimit).toBe(1);
  });

  it.each(["0", "-1", "abc"])("整数 env の不正値 %s は起動エラー", (v) => {
    process.env.APP_MODE = "mock";
    process.env.PER_USER_DAILY_LIMIT = v;
    expect(() => loadConfig()).toThrow(/positive integer/);
  });

  it("real モードで必須 env が無ければ起動エラー", () => {
    process.env.APP_MODE = "real";
    expect(() => loadConfig()).toThrow(/required env not set/);
  });

  it("real モードで空文字の必須 env は未設定として起動エラー", () => {
    process.env.APP_MODE = "real";
    process.env.GOOGLE_CLOUD_PROJECT = "";
    expect(() => loadConfig()).toThrow(/required env not set/);
  });

  it("real モードで必須 env が揃えば値が反映される", () => {
    process.env.APP_MODE = "real";
    process.env.APP_ENV = "dev";
    process.env.GOOGLE_CLOUD_PROJECT = "proj";
    process.env.GOOGLE_CLOUD_LOCATION = "loc";
    process.env.FRONTEND_URL = "https://example.com";
    process.env.GEMINI_MODEL = "gemini-test";
    process.env.PER_USER_DAILY_LIMIT = "10";
    process.env.GLOBAL_DAILY_LIMIT = "100";
    process.env.POKEMON_SNAPSHOT_URI = "gs://bucket/pokemon-snapshot.json";

    const cfg = loadConfig();
    expect(cfg).toMatchObject({
      appMode: "real",
      environment: "dev",
      googleCloudProject: "proj",
      googleCloudLocation: "loc",
      frontendURL: "https://example.com",
      geminiModel: "gemini-test",
      perUserDailyLimit: 10,
      globalDailyLimit: 100,
      pokemonSnapshotURI: "gs://bucket/pokemon-snapshot.json",
    });
  });
});
