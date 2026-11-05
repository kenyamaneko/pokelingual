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

describe("[運用:起動設定]起動設定の読み込み", () => {
  beforeEach(() => {
    clearConfigEnv();
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  describe("チューニングパラメーターの環境変数がすべて設定されているとき", () => {
    beforeEach(() => {
      setDefaultTuningEnv();
    });

    describe("単体テスト", () => {
      describe("正常系", () => {
        it("APP_MODE が mock のとき、起動設定の動作モードは mock になる", () => {
          process.env.APP_MODE = "mock";
          expect(loadConfig().appMode).toBe("mock");
        });
      });

      describe("異常系", () => {
        it("APP_MODE が未設定のとき、APP_MODE が未設定であることを示す起動エラーになる", () => {
          expect(() => loadConfig()).toThrow(/required env not set: APP_MODE/);
        });

        it("APP_MODE が mock でも real でもない prod のとき、APP_MODE の値が不正であることを示す起動エラーになる", () => {
          process.env.APP_MODE = "prod";
          expect(() => loadConfig()).toThrow(/invalid env: APP_MODE/);
        });
      });
    });

    describe("APP_MODE が mock のとき", () => {
      beforeEach(() => {
        process.env.APP_MODE = "mock";
      });

      describe("チューニングパラメーター以外の環境変数が 1 つも設定されていないとき", () => {
        describe("単体テスト", () => {
          describe("正常系", () => {
            it("起動設定の Google Cloud のプロジェクトは pokelingual-mock になる", () => {
              expect(loadConfig().googleCloudProject).toBe("pokelingual-mock");
            });

            it("起動設定のユーザー 1 人あたりの AI 呼び出しの日次上限は 30 回になる", () => {
              expect(loadConfig().perUserDailyLimit).toBe(30);
            });

            it("起動設定の全ユーザー合計の AI 呼び出しの日次上限は 1500 回になる", () => {
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
      });

      describe("単体テスト", () => {
        describe("正常系", () => {
          it("PER_USER_DAILY_LIMIT が下限の 1 のとき、起動設定のユーザー 1 人あたりの AI 呼び出しの日次上限は 1 回になる", () => {
            process.env.PER_USER_DAILY_LIMIT = "1";
            expect(loadConfig().perUserDailyLimit).toBe(1);
          });

          it("MASTER_BALL_MIN_SCORE が最終評価点の下限の 0 のとき、起動設定の確定捕獲に必要な最終評価点の下限は 0 になる", () => {
            process.env.MASTER_BALL_MIN_SCORE = "0";
            expect(loadConfig().masterBallMinScore).toBe(0);
          });

          it("MASTER_BALL_MIN_SCORE が最終評価点の上限の 99 のとき、起動設定の確定捕獲に必要な最終評価点の下限は 99 になる", () => {
            process.env.MASTER_BALL_MIN_SCORE = "99";
            expect(loadConfig().masterBallMinScore).toBe(99);
          });

          it("BALL_CAPTURE_BONUS_GREAT が 2.25 のとき、起動設定のスーパーボールのボール補正は 2.25 になる", () => {
            process.env.BALL_CAPTURE_BONUS_GREAT = "2.25";
            expect(loadConfig().ballCaptureBonus.great).toBe(2.25);
          });

          it("BALL_CAPTURE_BONUS_POKE が下限の 0 のとき、起動設定のモンスターボールのボール補正は 0 になる", () => {
            process.env.BALL_CAPTURE_BONUS_POKE = "0";
            expect(loadConfig().ballCaptureBonus.poke).toBe(0);
          });

          it("LEGENDARY_ENCOUNTER_RATE が下限の 0 のとき、起動設定の幻・伝説の出現確率は 0 になる", () => {
            process.env.LEGENDARY_ENCOUNTER_RATE = "0";
            expect(loadConfig().legendaryEncounterRate).toBe(0);
          });

          it("LEGENDARY_ENCOUNTER_RATE が上限の 1 のとき、起動設定の幻・伝説の出現確率は 1 になる", () => {
            process.env.LEGENDARY_ENCOUNTER_RATE = "1";
            expect(loadConfig().legendaryEncounterRate).toBe(1);
          });
        });

        describe("異常系", () => {
          it.each(["0", "abc"])(
            "PER_USER_DAILY_LIMIT が %s のとき、PER_USER_DAILY_LIMIT が 1 以上の整数でないという起動エラーになる",
            (value) => {
              process.env.PER_USER_DAILY_LIMIT = value;
              expect(() => loadConfig()).toThrow(/invalid env: PER_USER_DAILY_LIMIT=.*must be an integer between 1 and/);
            },
          );

          it.each([
            ["最終評価点の下限 0 を下回る", "-1"],
            ["最終評価点の上限 99 を超える", "100"],
            ["整数でない", "1.5"],
          ])(
            "MASTER_BALL_MIN_SCORE が%s %s のとき、MASTER_BALL_MIN_SCORE が 0 以上 99 以下の整数でないという起動エラーになる",
            (_label, value) => {
              process.env.MASTER_BALL_MIN_SCORE = value;
              expect(() => loadConfig()).toThrow(/invalid env: MASTER_BALL_MIN_SCORE=.*must be an integer between 0 and 99/);
            },
          );

          it("BALL_CAPTURE_BONUS_POKE が下限 0 を下回る -0.01 のとき、BALL_CAPTURE_BONUS_POKE の値が許容範囲の数でないことを示す起動エラーになる", () => {
            process.env.BALL_CAPTURE_BONUS_POKE = "-0.01";
            expect(() => loadConfig()).toThrow(/invalid env: BALL_CAPTURE_BONUS_POKE=-0\.01 \(must be a number between 0 and/);
          });

          it.each([
            ["下限 0 を下回る", "-0.01"],
            ["上限 1 を上回る", "1.01"],
            ["数でない", "abc"],
          ])(
            "LEGENDARY_ENCOUNTER_RATE が%s %s のとき、LEGENDARY_ENCOUNTER_RATE が 0 以上 1 以下の数でないという起動エラーになる",
            (_label, value) => {
              process.env.LEGENDARY_ENCOUNTER_RATE = value;
              expect(() => loadConfig()).toThrow(/invalid env: LEGENDARY_ENCOUNTER_RATE=.*must be a number between 0 and 1/);
            },
          );
        });
      });
    });

    describe("APP_MODE が real で、チューニングパラメーター以外の必須の環境変数がすべて設定されているとき", () => {
      beforeEach(() => {
        process.env.APP_MODE = "real";
        setRealRequiredEnv();
      });

      describe("単体テスト", () => {
        describe("正常系", () => {
          it("起動設定の動作モードは real になる", () => {
            expect(loadConfig().appMode).toBe("real");
          });

          it("GOOGLE_CLOUD_PROJECT が proj のとき、起動設定の Google Cloud のプロジェクトは proj になる", () => {
            expect(loadConfig().googleCloudProject).toBe("proj");
          });

          it("GOOGLE_CLOUD_LOCATION が loc のとき、起動設定の Google Cloud のロケーションは loc になる", () => {
            expect(loadConfig().googleCloudLocation).toBe("loc");
          });

          it("FRONTEND_URL が https://example.com のとき、起動設定のフロントエンドの URL は https://example.com になる", () => {
            expect(loadConfig().frontendURL).toBe("https://example.com");
          });

          it("GEMINI_MODEL が gemini-test のとき、起動設定の Gemini のモデルは gemini-test になる", () => {
            expect(loadConfig().geminiModel).toBe("gemini-test");
          });

          it("PER_USER_DAILY_LIMIT が 10 のとき、起動設定のユーザー 1 人あたりの AI 呼び出しの日次上限は 10 回になる", () => {
            expect(loadConfig().perUserDailyLimit).toBe(10);
          });

          it("GLOBAL_DAILY_LIMIT が 100 のとき、起動設定の全ユーザー合計の AI 呼び出しの日次上限は 100 回になる", () => {
            expect(loadConfig().globalDailyLimit).toBe(100);
          });

          it("POKEMON_SNAPSHOT_URI が gs://bucket/pokemon-snapshot.json のとき、起動設定のポケモンデータのスナップショットの読み込み元は gs://bucket/pokemon-snapshot.json になる", () => {
            expect(loadConfig().pokemonSnapshotURI).toBe("gs://bucket/pokemon-snapshot.json");
          });

          it("UPSTASH_REDIS_URL が rediss://default:token@redis-endpoint.upstash.io:6379 のとき、起動設定のクエストセッションの接続先 URL は rediss://default:token@redis-endpoint.upstash.io:6379 になる", () => {
            expect(loadConfig().questSessionRedisURL).toBe("rediss://default:token@redis-endpoint.upstash.io:6379");
          });

          it("QUEST_SESSION_TTL_SECONDS が 1800 のとき、起動設定のクエストセッションの有効期限は 1800 秒になる", () => {
            expect(loadConfig().questSessionTTLSeconds).toBe(1800);
          });

          it("FUZZY_MATCH_MIN_NAME_LENGTH が 5 のとき、起動設定の名前当てのあいまい一致を有効にする英語名の最小文字数は 5 文字になる", () => {
            process.env.FUZZY_MATCH_MIN_NAME_LENGTH = "5";
            expect(loadConfig().fuzzyMatchMinNameLength).toBe(5);
          });

          it("FUZZY_MATCH_MAX_DISTANCE が 1 のとき、起動設定の名前当てで正解扱いにする編集距離の上限は 1 になる", () => {
            process.env.FUZZY_MATCH_MAX_DISTANCE = "1";
            expect(loadConfig().fuzzyMatchMaxDistance).toBe(1);
          });

          it("BALL_CAPTURE_BONUS_POKE が 0 のとき、起動設定のモンスターボールのボール補正は 0 になる", () => {
            process.env.BALL_CAPTURE_BONUS_POKE = "0";
            expect(loadConfig().ballCaptureBonus.poke).toBe(0);
          });

          it("BALL_CAPTURE_BONUS_GREAT が 2 のとき、起動設定のスーパーボールのボール補正は 2 になる", () => {
            process.env.BALL_CAPTURE_BONUS_GREAT = "2";
            expect(loadConfig().ballCaptureBonus.great).toBe(2);
          });

          it("BALL_CAPTURE_BONUS_ULTRA が 4 のとき、起動設定のハイパーボールのボール補正は 4 になる", () => {
            process.env.BALL_CAPTURE_BONUS_ULTRA = "4";
            expect(loadConfig().ballCaptureBonus.ultra).toBe(4);
          });

          it("LEGENDARY_ENCOUNTER_RATE が 0.02 のとき、起動設定の幻・伝説の出現確率は 0.02 になる", () => {
            process.env.LEGENDARY_ENCOUNTER_RATE = "0.02";
            expect(loadConfig().legendaryEncounterRate).toBe(0.02);
          });

          it("LOCATION_CHOICE_COUNT が 3 のとき、起動設定の場所選択に提示する場所の数は 3 か所になる", () => {
            process.env.LOCATION_CHOICE_COUNT = "3";
            expect(loadConfig().locationChoiceCount).toBe(3);
          });

          it("MASTER_BALL_MIN_SCORE が 80 のとき、起動設定の確定捕獲に必要な最終評価点の下限は 80 になる", () => {
            process.env.MASTER_BALL_MIN_SCORE = "80";
            expect(loadConfig().masterBallMinScore).toBe(80);
          });

          it("MAX_EXCLUDED_POKEMON_COUNT が 20 のとき、起動設定の除外ポケモンの数の上限は 20 匹になる", () => {
            process.env.MAX_EXCLUDED_POKEMON_COUNT = "20";
            expect(loadConfig().maxExcludedPokemonCount).toBe(20);
          });
        });

        describe("異常系", () => {
          it.each([
            ["空文字", ""],
            ["空白のみ (半角スペース 3 文字)", "   "],
          ])(
            "GOOGLE_CLOUD_PROJECT が%sのとき、GOOGLE_CLOUD_PROJECT が未設定であることを示す起動エラーになる",
            (_label, value) => {
              process.env.GOOGLE_CLOUD_PROJECT = value;
              expect(() => loadConfig()).toThrow(/required env not set: GOOGLE_CLOUD_PROJECT/);
            },
          );
        });
      });
    });

    describe("APP_MODE が real で、チューニングパラメーター以外の必須の環境変数が 1 つも設定されていないとき", () => {
      beforeEach(() => {
        process.env.APP_MODE = "real";
      });

      describe("単体テスト", () => {
        describe("異常系", () => {
          it("必須の環境変数が未設定であることを示す起動エラーになる", () => {
            expect(() => loadConfig()).toThrow(/required env not set/);
          });
        });
      });
    });
  });

  describe("単体テスト", () => {
    describe("異常系", () => {
      it("APP_MODE が mock で、チューニングパラメーターのうち FUZZY_MATCH_MIN_NAME_LENGTH だけが未設定のとき、FUZZY_MATCH_MIN_NAME_LENGTH が未設定であることを示す起動エラーになる", () => {
        setDefaultTuningEnv();
        delete process.env.FUZZY_MATCH_MIN_NAME_LENGTH;
        process.env.APP_MODE = "mock";
        expect(() => loadConfig()).toThrow(/required env not set: FUZZY_MATCH_MIN_NAME_LENGTH/);
      });
    });
  });
});
