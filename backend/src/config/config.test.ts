import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig } from "./config.js";

// loadConfig は process.env を読むため、テストごとに退避・復元する。
const ORIGINAL_ENV = { ...process.env };

/** loadConfig が参照する env を全て消す。 */
function clearConfigEnv(): void {
  for (const key of [
    "APP_MODE",
    "PORT",
    "GOOGLE_CLOUD_PROJECT",
    "GOOGLE_CLOUD_LOCATION",
    "FRONTEND_URL",
    "PER_USER_DAILY_LIMIT",
    "GLOBAL_DAILY_LIMIT",
  ]) {
    delete process.env[key];
  }
}

describe("loadConfig", () => {
  beforeEach(clearConfigEnv);
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("env 未設定なら mock モードで既定値になる", () => {
    const cfg = loadConfig();
    expect(cfg.appMode).toBe("mock");
    expect(cfg.googleCloudProject).toBe("pokelingual-mock");
    expect(cfg.perUserDailyLimit).toBe(30);
    expect(cfg.globalDailyLimit).toBe(1500);
  });

  it("整数 env の境界: 1 は受理される", () => {
    process.env.PER_USER_DAILY_LIMIT = "1";
    expect(loadConfig().perUserDailyLimit).toBe(1);
  });

  it.each(["0", "-1", "abc"])("整数 env の不正値 %s は起動エラー", (v) => {
    process.env.PER_USER_DAILY_LIMIT = v;
    expect(() => loadConfig()).toThrow(/positive integer/);
  });

  it("本番モードで必須 env が無ければ起動エラー", () => {
    process.env.APP_MODE = "prod";
    expect(() => loadConfig()).toThrow(/required env not set/);
  });

  it("本番モードで空文字の必須 env は未設定として起動エラー", () => {
    process.env.APP_MODE = "prod";
    process.env.GOOGLE_CLOUD_PROJECT = "";
    expect(() => loadConfig()).toThrow(/required env not set/);
  });

  it("本番モードで必須 env が揃えば値が反映される", () => {
    process.env.APP_MODE = "prod";
    process.env.GOOGLE_CLOUD_PROJECT = "proj";
    process.env.GOOGLE_CLOUD_LOCATION = "loc";
    process.env.FRONTEND_URL = "https://example.com";
    process.env.PER_USER_DAILY_LIMIT = "10";
    process.env.GLOBAL_DAILY_LIMIT = "100";

    const cfg = loadConfig();
    expect(cfg).toMatchObject({
      appMode: "prod",
      googleCloudProject: "proj",
      googleCloudLocation: "loc",
      frontendURL: "https://example.com",
      perUserDailyLimit: 10,
      globalDailyLimit: 100,
    });
  });
});
