import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig } from "./config.js";

// loadConfig は process.env を読むため、テストごとに退避・復元する。
const ORIGINAL_ENV = { ...process.env };

function clearConfigEnv(): void {
  for (const key of [
    "APP_MODE",
    "PORT",
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

function setDefaultTuningEnv(): void {
  process.env.FUZZY_MATCH_MIN_NAME_LENGTH = "4";
  process.env.FUZZY_MATCH_MAX_DISTANCE = "2";
  process.env.BALL_CAPTURE_BONUS_POKE = "0";
  process.env.BALL_CAPTURE_BONUS_GREAT = "1.5";
  process.env.BALL_CAPTURE_BONUS_ULTRA = "3.0";
  process.env.LEGENDARY_ENCOUNTER_RATE = "0.01";
  process.env.LOCATION_CHOICE_COUNT = "4";
  process.env.MASTER_BALL_MIN_SCORE = "70";
  process.env.MAX_EXCLUDED_POKEMON_COUNT = "30";
}

function setRealRequiredEnv(): void {
  process.env.GOOGLE_CLOUD_PROJECT = "proj";
  process.env.GOOGLE_CLOUD_LOCATION = "loc";
  process.env.FRONTEND_URL = "https://example.com";
  process.env.GEMINI_MODEL = "gemini-test";
  process.env.PER_USER_DAILY_LIMIT = "10";
  process.env.GLOBAL_DAILY_LIMIT = "100";
  process.env.POKEMON_SNAPSHOT_URI = "gs://bucket/pokemon-snapshot.json";
  process.env.UPSTASH_REDIS_URL = "rediss://default:token@redis-endpoint.upstash.io:6379";
  process.env.QUEST_SESSION_TTL_SECONDS = "1800";
}

describe("[起動設定] 起動設定の読み込み", () => {
  // チューニングパラメーターはモード問わず必須のため、個別のテストの関心事でない限り既定値を敷いておく。
  beforeEach(() => {
    clearConfigEnv();
    setDefaultTuningEnv();
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  describe("動作モード APP_MODE の指定", () => {
    describe("正常系", () => {
      it("APP_MODE が mock のとき、起動設定の動作モードは mock になる", () => {
        process.env.APP_MODE = "mock";
        expect(loadConfig().appMode).toBe("mock");
      });
    });

    describe("異常系", () => {
      it("APP_MODE が未設定のとき、未設定を示す起動エラーになる", () => {
        expect(() => loadConfig()).toThrow(/required env not set: APP_MODE/);
      });

      it("APP_MODE が mock でも real でもない prod のとき、値が不正であることを示す起動エラーになる", () => {
        process.env.APP_MODE = "prod";
        expect(() => loadConfig()).toThrow(/invalid env: APP_MODE/);
      });
    });
  });

  describe("mock モード", () => {
    describe("正常系", () => {
      describe("チューニングパラメーター以外の環境変数が未設定のとき", () => {
        beforeEach(() => {
          process.env.APP_MODE = "mock";
        });

        it("起動設定の Google Cloud のプロジェクトは pokelingual-mock になる", () => {
          expect(loadConfig().googleCloudProject).toBe("pokelingual-mock");
        });

        it("起動設定のユーザー 1 人あたりの 1 日の AI 呼び出し回数の上限は 30 回になる", () => {
          expect(loadConfig().perUserDailyLimit).toBe(30);
        });

        it("起動設定の全ユーザー合計の 1 日の AI 呼び出し回数の上限は 1500 回になる", () => {
          expect(loadConfig().globalDailyLimit).toBe(1500);
        });

        it("起動設定のクエストセッションの接続先 URL は redis://valkey:6379 になる", () => {
          expect(loadConfig().questSessionRedisURL).toBe("redis://valkey:6379");
        });

        it("起動設定のクエストセッションの有効期限は 3600 秒になる", () => {
          expect(loadConfig().questSessionTTLSeconds).toBe(3600);
        });
      });
    });

    describe("異常系", () => {
      it("チューニングパラメーターの FUZZY_MATCH_MIN_NAME_LENGTH が未設定のとき、未設定を示す起動エラーになる", () => {
        process.env.APP_MODE = "mock";
        delete process.env.FUZZY_MATCH_MIN_NAME_LENGTH;
        expect(() => loadConfig()).toThrow(/required env not set: FUZZY_MATCH_MIN_NAME_LENGTH/);
      });
    });
  });

  describe("real モード", () => {
    describe("正常系", () => {
      it("必須の環境変数がすべて設定されているとき、起動設定の各項目は指定した環境変数の値になる", () => {
        process.env.APP_MODE = "real";
        setRealRequiredEnv();
        process.env.FUZZY_MATCH_MIN_NAME_LENGTH = "5";
        process.env.FUZZY_MATCH_MAX_DISTANCE = "1";
        process.env.BALL_CAPTURE_BONUS_POKE = "0";
        process.env.BALL_CAPTURE_BONUS_GREAT = "2";
        process.env.BALL_CAPTURE_BONUS_ULTRA = "4";
        process.env.LEGENDARY_ENCOUNTER_RATE = "0.02";
        process.env.LOCATION_CHOICE_COUNT = "3";
        process.env.MASTER_BALL_MIN_SCORE = "80";
        process.env.MAX_EXCLUDED_POKEMON_COUNT = "20";

        expect(loadConfig()).toMatchObject({
          appMode: "real",
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

    describe("異常系", () => {
      it("必須の環境変数が 1 つも設定されていないとき、未設定を示す起動エラーになる", () => {
        process.env.APP_MODE = "real";
        expect(() => loadConfig()).toThrow(/required env not set/);
      });

      describe("他の必須の環境変数がすべて設定されていて GOOGLE_CLOUD_PROJECT が指定されたとき", () => {
        beforeEach(() => {
          process.env.APP_MODE = "real";
          setRealRequiredEnv();
        });

        it.each([
          ["空文字", ""],
          ["空白のみ", "   "],
        ])("%sのとき、未設定として起動エラーになる", (_label, value) => {
          process.env.GOOGLE_CLOUD_PROJECT = value;
          expect(() => loadConfig()).toThrow(/required env not set: GOOGLE_CLOUD_PROJECT/);
        });
      });
    });
  });

  describe("ユーザー 1 人あたりの 1 日の AI 呼び出し回数の上限 PER_USER_DAILY_LIMIT の指定", () => {
    describe("正常系", () => {
      it("PER_USER_DAILY_LIMIT が下限の 1 のとき、起動設定のユーザー 1 人あたりの 1 日の AI 呼び出し回数の上限は 1 回になる", () => {
        process.env.APP_MODE = "mock";
        process.env.PER_USER_DAILY_LIMIT = "1";
        expect(loadConfig().perUserDailyLimit).toBe(1);
      });
    });

    describe("異常系", () => {
      it.each(["0", "-1", "abc"])(
        "PER_USER_DAILY_LIMIT が %s のとき、1 以上の整数でないという起動エラーになる",
        (value) => {
          process.env.APP_MODE = "mock";
          process.env.PER_USER_DAILY_LIMIT = value;
          expect(() => loadConfig()).toThrow(/invalid env: PER_USER_DAILY_LIMIT=.*must be an integer between 1 and/);
        },
      );
    });
  });

  describe("マスターボールで確定捕獲できる最終評価点の下限 MASTER_BALL_MIN_SCORE の指定", () => {
    describe("正常系", () => {
      it.each([
        ["最終評価点の下限の 0", "0", 0],
        ["最終評価点の上限の 99", "99", 99],
      ])(
        "MASTER_BALL_MIN_SCORE が%s のとき、起動設定の確定捕獲に必要な最終評価点の下限は %s になる",
        (_label, value, expected) => {
          process.env.APP_MODE = "mock";
          process.env.MASTER_BALL_MIN_SCORE = value;
          expect(loadConfig().masterBallMinScore).toBe(expected);
        },
      );
    });

    describe("異常系", () => {
      it.each([
        ["最終評価点の上限 99 を超える", "100"],
        ["整数でない", "1.5"],
      ])(
        "MASTER_BALL_MIN_SCORE が%s %s のとき、0 以上 99 以下の整数でないという起動エラーになる",
        (_label, value) => {
          process.env.APP_MODE = "mock";
          process.env.MASTER_BALL_MIN_SCORE = value;
          expect(() => loadConfig()).toThrow(/invalid env: MASTER_BALL_MIN_SCORE=.*must be an integer between 0 and 99/);
        },
      );
    });
  });

  describe("小数で指定する環境変数", () => {
    describe("正常系", () => {
      it("BALL_CAPTURE_BONUS_GREAT が小数のとき、起動設定のスーパーボールのボール補正は指定した小数になる", () => {
        process.env.APP_MODE = "mock";
        process.env.BALL_CAPTURE_BONUS_GREAT = "2.25";
        expect(loadConfig().ballCaptureBonus.great).toBe(2.25);
      });

      it("BALL_CAPTURE_BONUS_POKE が下限の 0 のとき、起動設定のモンスターボールのボール補正は 0 になる", () => {
        process.env.APP_MODE = "mock";
        process.env.BALL_CAPTURE_BONUS_POKE = "0";
        expect(loadConfig().ballCaptureBonus.poke).toBe(0);
      });
    });

    describe("異常系", () => {
      it.each([
        ["下限 0 を下回る", "-0.01"],
        ["上限 1 を上回る", "1.01"],
        ["数でない", "abc"],
      ])(
        "LEGENDARY_ENCOUNTER_RATE が%s %s のとき、0 以上 1 以下の数でないという起動エラーになる",
        (_label, value) => {
          process.env.APP_MODE = "mock";
          process.env.LEGENDARY_ENCOUNTER_RATE = value;
          expect(() => loadConfig()).toThrow(/invalid env: LEGENDARY_ENCOUNTER_RATE=.*must be a number between 0 and 1/);
        },
      );
    });
  });
});
