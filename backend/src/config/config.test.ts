import { describe, expect, beforeEach, afterEach } from "vitest";
import { loadConfig } from "./config.js";
import { defineCase, type Viewpoint } from "../test/defineCase.js";

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

function setMockModeEnv(): void {
  setDefaultTuningEnv();
  process.env.APP_MODE = "mock";
}

function setRealModeEnv(): void {
  setDefaultTuningEnv();
  process.env.APP_MODE = "real";
  setRealRequiredEnv();
}

const LOAD_CONFIG = "起動設定を読み込む";
const TUNING_SET = "チューニングパラメーターの環境変数がすべて設定されていて";
const MOCK_MODE = `${TUNING_SET}、APP_MODE が mock で`;
const REAL_MODE = `${TUNING_SET}、APP_MODE が real で、チューニングパラメーター以外の必須の環境変数がすべて設定されていて`;
const MOCK_MODE_WITHOUT_OTHER_ENV = `${MOCK_MODE}、チューニングパラメーター以外の環境変数が 1 つも設定されていないとき`;

describe("[運用:起動と設定]起動設定の読み込み", () => {
  beforeEach(() => {
    clearConfigEnv();
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: `${TUNING_SET}、APP_MODE が mock のとき`, When: [LOAD_CONFIG], Then: "起動設定の動作モードは mock になる" }],
    },
    () => {
      setDefaultTuningEnv();
      process.env.APP_MODE = "mock";
      expect(loadConfig().appMode).toBe("mock");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      steps: [{ Given: `${TUNING_SET}、APP_MODE が未設定のとき`, When: [LOAD_CONFIG], Then: "APP_MODE が未設定であることを示す起動エラーになる" }],
    },
    () => {
      setDefaultTuningEnv();
      expect(() => loadConfig()).toThrow(/required env not set: APP_MODE/);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      steps: [{ Given: `${TUNING_SET}、APP_MODE が mock でも real でもない prod のとき`, When: [LOAD_CONFIG], Then: "APP_MODE の値が不正であることを示す起動エラーになる" }],
    },
    () => {
      setDefaultTuningEnv();
      process.env.APP_MODE = "prod";
      expect(() => loadConfig()).toThrow(/invalid env: APP_MODE/);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: MOCK_MODE_WITHOUT_OTHER_ENV, When: [LOAD_CONFIG], Then: "起動設定の Google Cloud のプロジェクトは pokelingual-mock になる" }],
    },
    () => {
      setMockModeEnv();
      expect(loadConfig().googleCloudProject).toBe("pokelingual-mock");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: MOCK_MODE_WITHOUT_OTHER_ENV, When: [LOAD_CONFIG], Then: "起動設定のユーザー 1 人あたりの AI 呼び出しの日次上限は 30 回になる" }],
    },
    () => {
      setMockModeEnv();
      expect(loadConfig().perUserDailyLimit).toBe(30);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: MOCK_MODE_WITHOUT_OTHER_ENV, When: [LOAD_CONFIG], Then: "起動設定の全ユーザー合計の AI 呼び出しの日次上限は 1500 回になる" }],
    },
    () => {
      setMockModeEnv();
      expect(loadConfig().globalDailyLimit).toBe(1500);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: MOCK_MODE_WITHOUT_OTHER_ENV, When: [LOAD_CONFIG], Then: "起動設定のクエストセッションの接続先 URL は redis://valkey:6379 になる" }],
    },
    () => {
      setMockModeEnv();
      expect(loadConfig().questSessionRedisURL).toBe("redis://valkey:6379");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: MOCK_MODE_WITHOUT_OTHER_ENV, When: [LOAD_CONFIG], Then: "起動設定のクエストセッションの有効期限は 3600 秒になる" }],
    },
    () => {
      setMockModeEnv();
      expect(loadConfig().questSessionTTLSeconds).toBe(3600);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["境界値"],
      steps: [{ Given: `${MOCK_MODE}、PER_USER_DAILY_LIMIT が下限の 1 のとき`, When: [LOAD_CONFIG], Then: "起動設定のユーザー 1 人あたりの AI 呼び出しの日次上限は 1 回になる" }],
    },
    () => {
      setMockModeEnv();
      process.env.PER_USER_DAILY_LIMIT = "1";
      expect(loadConfig().perUserDailyLimit).toBe(1);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["境界値"],
      steps: [{ Given: `${MOCK_MODE}、MASTER_BALL_MIN_SCORE が最終評価点の下限の 0 のとき`, When: [LOAD_CONFIG], Then: "起動設定の確定捕獲に必要な最終評価点の下限は 0 になる" }],
    },
    () => {
      setMockModeEnv();
      process.env.MASTER_BALL_MIN_SCORE = "0";
      expect(loadConfig().masterBallMinScore).toBe(0);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["境界値"],
      steps: [{ Given: `${MOCK_MODE}、MASTER_BALL_MIN_SCORE が最終評価点の上限の 99 のとき`, When: [LOAD_CONFIG], Then: "起動設定の確定捕獲に必要な最終評価点の下限は 99 になる" }],
    },
    () => {
      setMockModeEnv();
      process.env.MASTER_BALL_MIN_SCORE = "99";
      expect(loadConfig().masterBallMinScore).toBe(99);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: `${MOCK_MODE}、BALL_CAPTURE_BONUS_GREAT が 2.25 のとき`, When: [LOAD_CONFIG], Then: "起動設定のスーパーボールのボール補正は 2.25 になる" }],
    },
    () => {
      setMockModeEnv();
      process.env.BALL_CAPTURE_BONUS_GREAT = "2.25";
      expect(loadConfig().ballCaptureBonus.great).toBe(2.25);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["境界値"],
      steps: [{ Given: `${MOCK_MODE}、LEGENDARY_ENCOUNTER_RATE が下限の 0 のとき`, When: [LOAD_CONFIG], Then: "起動設定の幻・伝説の出現確率は 0 になる" }],
    },
    () => {
      setMockModeEnv();
      process.env.LEGENDARY_ENCOUNTER_RATE = "0";
      expect(loadConfig().legendaryEncounterRate).toBe(0);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      観点: ["境界値"],
      steps: [{ Given: `${MOCK_MODE}、LEGENDARY_ENCOUNTER_RATE が上限の 1 のとき`, When: [LOAD_CONFIG], Then: "起動設定の幻・伝説の出現確率は 1 になる" }],
    },
    () => {
      setMockModeEnv();
      process.env.LEGENDARY_ENCOUNTER_RATE = "1";
      expect(loadConfig().legendaryEncounterRate).toBe(1);
    },
  );

  const PER_USER_DAILY_LIMIT_CASES: { value: string; 観点: readonly Viewpoint[] }[] = [
    { value: "0", 観点: ["境界値"] },
    { value: "abc", 観点: [] },
  ];

  for (const { value, 観点 } of PER_USER_DAILY_LIMIT_CASES) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "異常系",
        観点,
        steps: [{ Given: `${MOCK_MODE}、PER_USER_DAILY_LIMIT が ${value} のとき`, When: [LOAD_CONFIG], Then: "PER_USER_DAILY_LIMIT が 1 以上の整数でないことを示す起動エラーになる" }],
      },
      () => {
        setMockModeEnv();
        process.env.PER_USER_DAILY_LIMIT = value;
        expect(() => loadConfig()).toThrow(/invalid env: PER_USER_DAILY_LIMIT=.*must be an integer between 1 and/);
      },
    );
  }

  const MASTER_BALL_MIN_SCORE_CASES: { label: string; value: string; 観点: readonly Viewpoint[] }[] = [
    { label: "最終評価点の下限 0 を下回る", value: "-1", 観点: ["境界値"] },
    { label: "最終評価点の上限 99 を超える", value: "100", 観点: ["境界値"] },
    { label: "整数でない", value: "1.5", 観点: [] },
  ];

  for (const { label, value, 観点 } of MASTER_BALL_MIN_SCORE_CASES) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "異常系",
        観点,
        steps: [{ Given: `${MOCK_MODE}、MASTER_BALL_MIN_SCORE が${label} ${value} のとき`, When: [LOAD_CONFIG], Then: "MASTER_BALL_MIN_SCORE が 0 以上 99 以下の整数でないことを示す起動エラーになる" }],
      },
      () => {
        setMockModeEnv();
        process.env.MASTER_BALL_MIN_SCORE = value;
        expect(() => loadConfig()).toThrow(/invalid env: MASTER_BALL_MIN_SCORE=.*must be an integer between 0 and 99/);
      },
    );
  }

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      観点: ["境界値"],
      steps: [{ Given: `${MOCK_MODE}、BALL_CAPTURE_BONUS_POKE が下限 0 を下回る -0.01 のとき`, When: [LOAD_CONFIG], Then: "BALL_CAPTURE_BONUS_POKE の値が許容範囲の数でないことを示す起動エラーになる" }],
    },
    () => {
      setMockModeEnv();
      process.env.BALL_CAPTURE_BONUS_POKE = "-0.01";
      expect(() => loadConfig()).toThrow(/invalid env: BALL_CAPTURE_BONUS_POKE=-0\.01 \(must be a number between 0 and/);
    },
  );

  const LEGENDARY_ENCOUNTER_RATE_CASES: { label: string; value: string; 観点: readonly Viewpoint[] }[] = [
    { label: "下限 0 を下回る", value: "-0.01", 観点: ["境界値"] },
    { label: "上限 1 を上回る", value: "1.01", 観点: ["境界値"] },
    { label: "数でない", value: "abc", 観点: [] },
  ];

  for (const { label, value, 観点 } of LEGENDARY_ENCOUNTER_RATE_CASES) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "異常系",
        観点,
        steps: [{ Given: `${MOCK_MODE}、LEGENDARY_ENCOUNTER_RATE が${label} ${value} のとき`, When: [LOAD_CONFIG], Then: "LEGENDARY_ENCOUNTER_RATE が 0 以上 1 以下の数でないことを示す起動エラーになる" }],
      },
      () => {
        setMockModeEnv();
        process.env.LEGENDARY_ENCOUNTER_RATE = value;
        expect(() => loadConfig()).toThrow(/invalid env: LEGENDARY_ENCOUNTER_RATE=.*must be a number between 0 and 1/);
      },
    );
  }

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: `${TUNING_SET}、APP_MODE が real で、チューニングパラメーター以外の必須の環境変数がすべて設定されているとき`, When: [LOAD_CONFIG], Then: "起動設定の動作モードは real になる" }],
    },
    () => {
      setRealModeEnv();
      expect(loadConfig().appMode).toBe("real");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: `${REAL_MODE}、GOOGLE_CLOUD_PROJECT が proj のとき`, When: [LOAD_CONFIG], Then: "起動設定の Google Cloud のプロジェクトは proj になる" }],
    },
    () => {
      setRealModeEnv();
      expect(loadConfig().googleCloudProject).toBe("proj");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: `${REAL_MODE}、GOOGLE_CLOUD_LOCATION が loc のとき`, When: [LOAD_CONFIG], Then: "起動設定の Google Cloud のロケーションは loc になる" }],
    },
    () => {
      setRealModeEnv();
      expect(loadConfig().googleCloudLocation).toBe("loc");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: `${REAL_MODE}、FRONTEND_URL が https://example.com のとき`, When: [LOAD_CONFIG], Then: "起動設定のフロントエンドの URL は https://example.com になる" }],
    },
    () => {
      setRealModeEnv();
      expect(loadConfig().frontendURL).toBe("https://example.com");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: `${REAL_MODE}、GEMINI_MODEL が gemini-test のとき`, When: [LOAD_CONFIG], Then: "起動設定の Gemini のモデルは gemini-test になる" }],
    },
    () => {
      setRealModeEnv();
      expect(loadConfig().geminiModel).toBe("gemini-test");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: `${REAL_MODE}、PER_USER_DAILY_LIMIT が 10 のとき`, When: [LOAD_CONFIG], Then: "起動設定のユーザー 1 人あたりの AI 呼び出しの日次上限は 10 回になる" }],
    },
    () => {
      setRealModeEnv();
      expect(loadConfig().perUserDailyLimit).toBe(10);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: `${REAL_MODE}、GLOBAL_DAILY_LIMIT が 100 のとき`, When: [LOAD_CONFIG], Then: "起動設定の全ユーザー合計の AI 呼び出しの日次上限は 100 回になる" }],
    },
    () => {
      setRealModeEnv();
      expect(loadConfig().globalDailyLimit).toBe(100);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: `${REAL_MODE}、POKEMON_SNAPSHOT_URI が gs://bucket/pokemon-snapshot.json のとき`, When: [LOAD_CONFIG], Then: "起動設定のポケモンデータのスナップショットの読み込み元は gs://bucket/pokemon-snapshot.json になる" }],
    },
    () => {
      setRealModeEnv();
      expect(loadConfig().pokemonSnapshotURI).toBe("gs://bucket/pokemon-snapshot.json");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: `${REAL_MODE}、UPSTASH_REDIS_URL が rediss://default:token@redis-endpoint.upstash.io:6379 のとき`, When: [LOAD_CONFIG], Then: "起動設定のクエストセッションの接続先 URL は rediss://default:token@redis-endpoint.upstash.io:6379 になる" }],
    },
    () => {
      setRealModeEnv();
      expect(loadConfig().questSessionRedisURL).toBe("rediss://default:token@redis-endpoint.upstash.io:6379");
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: `${REAL_MODE}、QUEST_SESSION_TTL_SECONDS が 1800 のとき`, When: [LOAD_CONFIG], Then: "起動設定のクエストセッションの有効期限は 1800 秒になる" }],
    },
    () => {
      setRealModeEnv();
      expect(loadConfig().questSessionTTLSeconds).toBe(1800);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: `${REAL_MODE}、FUZZY_MATCH_MIN_NAME_LENGTH が 5 のとき`, When: [LOAD_CONFIG], Then: "起動設定の名前当てのあいまい一致を有効にする英語名の最小文字数は 5 文字になる" }],
    },
    () => {
      setRealModeEnv();
      process.env.FUZZY_MATCH_MIN_NAME_LENGTH = "5";
      expect(loadConfig().fuzzyMatchMinNameLength).toBe(5);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: `${REAL_MODE}、FUZZY_MATCH_MAX_DISTANCE が 1 のとき`, When: [LOAD_CONFIG], Then: "起動設定の名前当てで正解扱いにする編集距離の上限は 1 になる" }],
    },
    () => {
      setRealModeEnv();
      process.env.FUZZY_MATCH_MAX_DISTANCE = "1";
      expect(loadConfig().fuzzyMatchMaxDistance).toBe(1);
    },
  );

  for (const { given, setModeEnv } of [
    { given: `${MOCK_MODE}、BALL_CAPTURE_BONUS_POKE が下限の 0 のとき`, setModeEnv: setMockModeEnv },
    { given: `${REAL_MODE}、BALL_CAPTURE_BONUS_POKE が 0 のとき`, setModeEnv: setRealModeEnv },
  ]) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "正常系",
        steps: [{ Given: given, When: [LOAD_CONFIG], Then: "起動設定のモンスターボールのボール補正は 0 になる" }],
      },
      () => {
        setModeEnv();
        process.env.BALL_CAPTURE_BONUS_POKE = "0";
        expect(loadConfig().ballCaptureBonus.poke).toBe(0);
      },
    );
  }

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: `${REAL_MODE}、BALL_CAPTURE_BONUS_GREAT が 2 のとき`, When: [LOAD_CONFIG], Then: "起動設定のスーパーボールのボール補正は 2 になる" }],
    },
    () => {
      setRealModeEnv();
      process.env.BALL_CAPTURE_BONUS_GREAT = "2";
      expect(loadConfig().ballCaptureBonus.great).toBe(2);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: `${REAL_MODE}、BALL_CAPTURE_BONUS_ULTRA が 4 のとき`, When: [LOAD_CONFIG], Then: "起動設定のハイパーボールのボール補正は 4 になる" }],
    },
    () => {
      setRealModeEnv();
      process.env.BALL_CAPTURE_BONUS_ULTRA = "4";
      expect(loadConfig().ballCaptureBonus.ultra).toBe(4);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: `${REAL_MODE}、LEGENDARY_ENCOUNTER_RATE が 0.02 のとき`, When: [LOAD_CONFIG], Then: "起動設定の幻・伝説の出現確率は 0.02 になる" }],
    },
    () => {
      setRealModeEnv();
      process.env.LEGENDARY_ENCOUNTER_RATE = "0.02";
      expect(loadConfig().legendaryEncounterRate).toBe(0.02);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: `${REAL_MODE}、LOCATION_CHOICE_COUNT が 3 のとき`, When: [LOAD_CONFIG], Then: "起動設定の場所選択に提示する場所の数は 3 か所になる" }],
    },
    () => {
      setRealModeEnv();
      process.env.LOCATION_CHOICE_COUNT = "3";
      expect(loadConfig().locationChoiceCount).toBe(3);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: `${REAL_MODE}、MASTER_BALL_MIN_SCORE が 80 のとき`, When: [LOAD_CONFIG], Then: "起動設定の確定捕獲に必要な最終評価点の下限は 80 になる" }],
    },
    () => {
      setRealModeEnv();
      process.env.MASTER_BALL_MIN_SCORE = "80";
      expect(loadConfig().masterBallMinScore).toBe(80);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "正常系",
      steps: [{ Given: `${REAL_MODE}、MAX_EXCLUDED_POKEMON_COUNT が 20 のとき`, When: [LOAD_CONFIG], Then: "起動設定の除外ポケモンの数の上限は 20 匹になる" }],
    },
    () => {
      setRealModeEnv();
      process.env.MAX_EXCLUDED_POKEMON_COUNT = "20";
      expect(loadConfig().maxExcludedPokemonCount).toBe(20);
    },
  );

  const GOOGLE_CLOUD_PROJECT_CASES: { label: string; value: string; 観点: readonly Viewpoint[] }[] = [
    { label: "空文字", value: "", 観点: ["件数・有無"] },
    { label: "半角スペース 3 文字", value: "   ", 観点: ["エッジケース"] },
  ];

  for (const { label, value, 観点 } of GOOGLE_CLOUD_PROJECT_CASES) {
    defineCase(
      {
        種別: "単体テスト",
        正常異常: "異常系",
        観点,
        steps: [{ Given: `${REAL_MODE}、GOOGLE_CLOUD_PROJECT が${label}のとき`, When: [LOAD_CONFIG], Then: "GOOGLE_CLOUD_PROJECT が未設定であることを示す起動エラーになる" }],
      },
      () => {
        setRealModeEnv();
        process.env.GOOGLE_CLOUD_PROJECT = value;
        expect(() => loadConfig()).toThrow(/required env not set: GOOGLE_CLOUD_PROJECT/);
      },
    );
  }

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      観点: ["件数・有無"],
      steps: [{ Given: `${TUNING_SET}、APP_MODE が real で、チューニングパラメーター以外の必須の環境変数が 1 つも設定されていないとき`, When: [LOAD_CONFIG], Then: "必須の環境変数が未設定であることを示す起動エラーになる" }],
    },
    () => {
      setDefaultTuningEnv();
      process.env.APP_MODE = "real";
      expect(() => loadConfig()).toThrow(/required env not set/);
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      steps: [{ Given: "APP_MODE が mock で、チューニングパラメーターのうち FUZZY_MATCH_MIN_NAME_LENGTH だけが未設定のとき", When: [LOAD_CONFIG], Then: "FUZZY_MATCH_MIN_NAME_LENGTH が未設定であることを示す起動エラーになる" }],
    },
    () => {
      setDefaultTuningEnv();
      delete process.env.FUZZY_MATCH_MIN_NAME_LENGTH;
      process.env.APP_MODE = "mock";
      expect(() => loadConfig()).toThrow(/required env not set: FUZZY_MATCH_MIN_NAME_LENGTH/);
    },
  );
});
