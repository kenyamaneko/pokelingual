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
    "UPSTASH_REDIS_URL",
    "QUEST_SESSION_TTL_SECONDS",
    "FUZZY_MATCH_MIN_NAME_LENGTH",
    "FUZZY_MATCH_MAX_DISTANCE",
    "BALL_CAPTURE_BONUS_POKE",
    "BALL_CAPTURE_BONUS_GREAT",
    "BALL_CAPTURE_BONUS_ULTRA",
    "LEGENDARY_ENCOUNTER_RATE",
    "LOCATION_CHOICE_COUNT",
    "MASTER_BALL_MIN_SCORE",
    "MAX_EXCLUDED_POKEMON_COUNT",
  ]) {
    delete process.env[key];
  }
}

describe("[起動設定] 起動設定の読み込み", () => {
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
    expect(cfg.questSessionRedisURL).toBe("redis://valkey:6379");
    expect(cfg.questSessionTTLSeconds).toBe(3600);
    expect(cfg.fuzzyMatchMinNameLength).toBe(4);
    expect(cfg.fuzzyMatchMaxDistance).toBe(2);
    expect(cfg.ballCaptureBonus).toEqual({ poke: 0, great: 1.5, ultra: 3.0 });
    expect(cfg.legendaryEncounterRate).toBe(0.01);
    expect(cfg.locationChoiceCount).toBe(4);
    expect(cfg.masterBallMinScore).toBe(70);
    expect(cfg.maxExcludedPokemonCount).toBe(30);
  });

  it("整数 env の 1 は受理される", () => {
    process.env.APP_MODE = "mock";
    process.env.PER_USER_DAILY_LIMIT = "1";
    expect(loadConfig().perUserDailyLimit).toBe(1);
  });

  it.each(["0", "-1", "abc"])("既定の最小値が1の整数 env で不正値 %s は起動エラー", (v) => {
    process.env.APP_MODE = "mock";
    process.env.PER_USER_DAILY_LIMIT = v;
    expect(() => loadConfig()).toThrow(/must be an integer/);
  });

  it("最小値0・最大値99の整数 env で下限0は受理される", () => {
    process.env.APP_MODE = "mock";
    process.env.MASTER_BALL_MIN_SCORE = "0";
    expect(loadConfig().masterBallMinScore).toBe(0);
  });

  it("最小値0・最大値99の整数 env で上限99は受理される", () => {
    process.env.APP_MODE = "mock";
    process.env.MASTER_BALL_MIN_SCORE = "99";
    expect(loadConfig().masterBallMinScore).toBe(99);
  });

  it("最小値0・最大値99の整数 env で上限を超える100は起動エラー", () => {
    process.env.APP_MODE = "mock";
    process.env.MASTER_BALL_MIN_SCORE = "100";
    expect(() => loadConfig()).toThrow(/must be an integer/);
  });

  it("整数 env の小数1.5は起動エラー", () => {
    process.env.APP_MODE = "mock";
    process.env.MASTER_BALL_MIN_SCORE = "1.5";
    expect(() => loadConfig()).toThrow(/must be an integer/);
  });

  it("浮動小数点数の env は小数として解釈される (整数への丸めはしない)", () => {
    process.env.APP_MODE = "mock";
    process.env.BALL_CAPTURE_BONUS_GREAT = "2.25";
    expect(loadConfig().ballCaptureBonus.great).toBe(2.25);
  });

  it("浮動小数点数 env の下限0は受理される (ボーナス無しのポケボールを表現できる)", () => {
    process.env.APP_MODE = "mock";
    process.env.BALL_CAPTURE_BONUS_POKE = "0";
    expect(loadConfig().ballCaptureBonus.poke).toBe(0);
  });

  it.each(["-0.01", "1.01", "abc"])("範囲付き浮動小数点数 env で範囲外・非数値の %s は起動エラー", (v) => {
    process.env.APP_MODE = "mock";
    process.env.LEGENDARY_ENCOUNTER_RATE = v;
    expect(() => loadConfig()).toThrow(/must be a number between 0 and 1/);
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

  it("real モードで空白のみの必須 env は未設定として起動エラー", () => {
    process.env.APP_MODE = "real";
    process.env.GOOGLE_CLOUD_PROJECT = "   ";
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
    process.env.UPSTASH_REDIS_URL = "rediss://default:token@redis-endpoint.upstash.io:6379";
    process.env.QUEST_SESSION_TTL_SECONDS = "1800";
    process.env.FUZZY_MATCH_MIN_NAME_LENGTH = "5";
    process.env.FUZZY_MATCH_MAX_DISTANCE = "1";
    process.env.BALL_CAPTURE_BONUS_POKE = "0";
    process.env.BALL_CAPTURE_BONUS_GREAT = "2";
    process.env.BALL_CAPTURE_BONUS_ULTRA = "4";
    process.env.LEGENDARY_ENCOUNTER_RATE = "0.02";
    process.env.LOCATION_CHOICE_COUNT = "3";
    process.env.MASTER_BALL_MIN_SCORE = "80";
    process.env.MAX_EXCLUDED_POKEMON_COUNT = "20";

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
      questSessionRedisURL: "rediss://default:token@redis-endpoint.upstash.io:6379",
      questSessionTTLSeconds: 1800,
      fuzzyMatchMinNameLength: 5,
      fuzzyMatchMaxDistance: 1,
      ballCaptureBonus: { poke: 0, great: 2, ultra: 4 },
      legendaryEncounterRate: 0.02,
      locationChoiceCount: 3,
      masterBallMinScore: 80,
      maxExcludedPokemonCount: 20,
    });
  });
});
