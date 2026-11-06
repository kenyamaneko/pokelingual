import { describe, expect } from "vitest";
import express from "express";
import request from "supertest";
import { setupRoutes } from "./router.js";
import { devAuth } from "../middleware/auth-mock.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { QuestService } from "../service/quest-service.js";
import { PokedexService } from "../service/pokedex-service.js";
import { SettingsService } from "../service/settings-service.js";
import { QuestHandler } from "../handler/quest-handler.js";
import { PokedexHandler } from "../handler/pokedex-handler.js";
import { SettingsHandler } from "../handler/settings-handler.js";
import { UsageHandler } from "../handler/usage-handler.js";
import { TutorialHandler } from "../handler/tutorial-handler.js";
import { createTutorialQuestHandler } from "../composition/tutorial-quest.js";
import { RateLimitError } from "../domain/errors.js";
import { DEFAULT_QUEST_TUNING } from "../testing/quest-tuning-fixture.js";
import { DEFAULT_MAX_EXCLUDED_POKEMON_COUNT } from "../testing/settings-fixture.js";
import type {
  LLMClient,
  RandomSource,
  RateLimitRepository,
  UserPokemonRepository,
  UserSettingsRepository,
  UserRepository,
} from "../domain/ports.js";
import type { UserPokemon, UserSettings } from "../domain/user.js";
import type { RateLimitKind } from "../domain/errors.js";
import { makePokemon, makePokemonClient } from "../testing/pokemon-fixtures.js";
import { makeInMemoryQuestSessionStore } from "../testing/session-store-fixture.js";
import { defineCase } from "../test/defineCase.js";

interface AppOverrides {
  llmError?: Error;
  rateLimitKind?: RateLimitKind;
  settingsError?: Error;
  pokemonError?: Error;
  sessionStoreError?: Error;
  seededUserPokemon?: UserPokemon[];
}

function makeApp(o: AppOverrides = {}) {
  const pokemonClient = makePokemonClient([makePokemon()], { error: o.pokemonError });
  const llm: LLMClient = {
    generateText: async () => {
      if (o.llmError) throw o.llmError;
      return JSON.stringify({ units: [0.7], review: "よい 翻訳だ。" });
    },
  };
  const servablePokemonIDs = new Set(Array.from({ length: 100 }, (_, i) => i + 1));
  const random: RandomSource = { next: () => 0 };

  // 保存結果を公開 API から観測するため、状態を持つインメモリ実装にする。
  const pokemonStore = new Map<number, UserPokemon>();
  for (const entry of o.seededUserPokemon ?? []) {
    pokemonStore.set(entry.pokemon_id, entry);
  }
  const userPokemonRepo: UserPokemonRepository = {
    upsertEncounter: async (_uid, pokemonID, score, isCaptured) => {
      pokemonStore.set(pokemonID, {
        pokemon_id: pokemonID,
        status: isCaptured ? "captured" : "seen",
        total_captures: isCaptured ? 1 : 0,
        total_encounters: 1,
        last_captured_at: isCaptured ? new Date() : null,
        last_encountered_at: new Date(),
        best_score: score,
      });
    },
    getPokedex: async () => [...pokemonStore.values()],
    getPokemon: async (_uid, pokemonID) => {
      const p = pokemonStore.get(pokemonID);
      if (!p) throw new Error(`not found: ${pokemonID}`);
      return p;
    },
  };

  let savedSettings: UserSettings = { excluded_pokemon_ids: null, enabled_generations: null };
  const settingsRepo: UserSettingsRepository = {
    getSettings: async () => {
      if (o.settingsError) throw o.settingsError;
      return savedSettings;
    },
    updateExcludedPokemon: async (_uid, ids) => {
      savedSettings = { ...savedSettings, excluded_pokemon_ids: ids };
    },
    updateEnabledGenerations: async (_uid, generations) => {
      savedSettings = { ...savedSettings, enabled_generations: generations };
    },
  };

  let tutorialCompleted = false;
  const userRepo: UserRepository = {
    getUser: async () => ({ tutorial_completed: tutorialCompleted }),
    markTutorialCompleted: async () => {
      tutorialCompleted = true;
    },
    resetTutorialCompleted: async () => {
      tutorialCompleted = false;
    },
  };

  const rateLimitRepo: RateLimitRepository = {
    checkAndIncrement: async () => {
      if (o.rateLimitKind) throw new RateLimitError(o.rateLimitKind);
      return { count: 1, limit: 30 };
    },
    getUserUsage: async () => ({ count: 3, limit: 30 }),
  };

  const sessionStore = makeInMemoryQuestSessionStore({ error: o.sessionStoreError });
  const tutorialSessionStore = makeInMemoryQuestSessionStore();
  const questService = new QuestService(
    pokemonClient,
    llm,
    settingsRepo,
    random,
    sessionStore,
    DEFAULT_QUEST_TUNING,
  );
  const pokedexService = new PokedexService(userPokemonRepo, pokemonClient, settingsRepo);
  const settingsService = new SettingsService(settingsRepo, servablePokemonIDs, DEFAULT_MAX_EXCLUDED_POKEMON_COUNT);

  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    setupRoutes(
      devAuth(),
      rateLimit(rateLimitRepo),
      new QuestHandler(questService, userPokemonRepo),
      createTutorialQuestHandler(tutorialSessionStore, DEFAULT_QUEST_TUNING),
      new PokedexHandler(pokedexService),
      new SettingsHandler(settingsService),
      new UsageHandler(rateLimitRepo),
      new TutorialHandler(userRepo),
    ),
  );
  return app;
}

const CALL_QUEST = "クエストの出題 API を呼び出す";
const CALL_SCORING = "翻訳の採点 API に、訳文「生まれたときから背中に不思議なタネが植えられていて、タネは体とともに育つ」を指定して呼び出す";
const CALL_HINT = "名前当てのヒントの取得 API を呼び出す";
const CALL_CURRENT_QUEST = "進行中のクエストの取得 API を呼び出す";
const CALL_SETTINGS = "設定の取得 API を呼び出す";
const CALL_TUTORIAL_STATUS = "チュートリアルの完了状態の取得 API を呼び出す";
const CALL_TUTORIAL_QUEST = "チュートリアルのクエストの出題 API を呼び出す";
const CALL_TUTORIAL_SCORING = "チュートリアルの翻訳の採点 API に、訳文「でたらめ」を指定して呼び出す";
const CALL_TUTORIAL_CAPTURE = "チュートリアルの捕獲 API を呼び出す";
const CALL_POKEDEX = "図鑑一覧の取得 API を呼び出す";
const NO_QUEST_SESSION = "クエストセッションが無いとき";
const EXTERNAL_SERVICE_UNAVAILABLE_ERROR = "API の応答は、外部サービスが利用できないことを示す 502 のエラーになる";
const NOT_FOUND_ERROR = "API の応答は、対象が見つからないことを示す 404 のエラーになる";
const INTERNAL_ERROR = "API の応答は、サーバー内部のエラーを示す 500 のエラーになる";
const USER_DAILY_LIMIT = "ユーザーの日次上限に達しているとき";
const GLOBAL_DAILY_LIMIT = "全体の日次上限に達しているとき";
const TUTORIAL_QUEST_ANSWERED =
  "チュートリアルのクエストで、出題と、訳文「電気タイプのねずみポケモン」の採点と、日本語名「ピカチュウ」の回答が済んでいるとき";
const TUTORIAL_QUEST_STARTED = "チュートリアルのクエストが出題されているとき";

describe("[本体:クエスト]出題から捕獲までの一連の操作", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "出題されるポケモンがフシギダネだけで、AI の採点結果が意味単位1件の判定値0.7で、捕獲の抽選が必ず成功するとき",
          When: [
            CALL_QUEST,
            "翻訳の採点 API に、訳文「生まれたときから背中に不思議なタネが植えられていて、タネは体とともに育つ」を指定して呼び出す",
            "名前当てのスキップ API を呼び出す",
            "捕獲 API を呼び出す",
            CALL_POKEDEX,
          ],
          Then: "各 API の応答が成功し、出題の英文は「A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokémon.」、最終評価点は 66、スキップで手に入るボールと捕獲に使われるボールはモンスターボールになり、捕獲に成功して、図鑑一覧にフシギダネが捕獲済みとして現れ、捕獲数は 1 になる",
        },
      ],
    },
    async () => {
      const app = makeApp();

      const quest = await request(app).get("/api/quest/new");
      expect(quest.status).toBe(200);
      expect(quest.body.description_en).toBe(
        "A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokémon.",
      );

      const score = await request(app).post("/api/quest/score").send({ translation: "生まれたときから背中に不思議なタネが植えられていて、タネは体とともに育つ" });
      expect(score.status).toBe(200);
      expect(score.body.score).toBe(66);

      const skip = await request(app).post("/api/quest/skip-guess").send({});
      expect(skip.status).toBe(200);
      expect(skip.body).toEqual({ ball_type: "poke" });

      const capture = await request(app).post("/api/quest/capture").send({});
      expect(capture.status).toBe(200);
      expect(capture.body.captured).toBe(true);
      expect(capture.body.ball_type).toBe("poke");

      const pokedex = await request(app).get("/api/pokedex");
      expect(pokedex.status).toBe(200);
      expect(pokedex.body.pokemon).toHaveLength(1);
      expect(pokedex.body.pokemon[0]).toMatchObject({ pokemon_id: 1, status: "captured" });
      expect(pokedex.body.captured_count).toBe(1);
    },
  );
});

describe("[本体:クエスト]クエストの出題", () => {
  for (const { given, overrides } of [
    {
      given: "ポケモンデータが利用できないとき",
      overrides: { pokemonError: new Error("pokemon data unavailable") },
    },
    {
      given: "クエストセッションの保存先が利用できないとき",
      overrides: { sessionStoreError: new Error("redis unavailable") },
    },
  ]) {
    defineCase(
      {
        種別: "部品間結合テスト",
        正常異常: "異常系",
        観点: ["外部依存の失敗"],
        steps: [
          {
            Given: given,
            When: [CALL_QUEST],
            Then: EXTERNAL_SERVICE_UNAVAILABLE_ERROR,
          },
        ],
      },
      async () => {
        const app = makeApp(overrides);
        const res = await request(app).get("/api/quest/new");
        expect(res.status).toBe(502);
        expect(res.body).toEqual({ error: "external service unavailable" });
      },
    );
  }

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      観点: ["外部依存の失敗"],
      steps: [
        {
          Given: "ユーザーの設定が利用できないとき",
          When: [CALL_QUEST],
          Then: "API の応答は、ユーザーの設定を取得できないことを示す 500 のエラーになる",
        },
      ],
    },
    async () => {
      const app = makeApp({ settingsError: new Error("boom") });
      const res = await request(app).get("/api/quest/new");
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: "internal server error" });
    },
  );
});

describe("[本体:クエスト]場所の候補提示", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          When: ["場所の候補の取得 API を呼び出す"],
          Then: "応答の場所の候補は 4 か所になる",
        },
      ],
    },
    async () => {
      const res = await request(makeApp()).get("/api/quest/locations");
      expect(res.status).toBe(200);
      expect(res.body.locations).toHaveLength(4);
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          When: ["場所の候補の取得 API を呼び出す"],
          Then: "応答の先頭の場所の候補は、ID「rocky-mountain」、名前「ゴツゴツの岩山」、説明「ごつごつした岩肌と土けむり。力自慢が集まる」、タイプ rock・ground・fighting・bug になる",
        },
      ],
    },
    async () => {
      const res = await request(makeApp()).get("/api/quest/locations");
      expect(res.status).toBe(200);
      expect(res.body.locations[0]).toEqual({
        id: "rocky-mountain",
        name: "ゴツゴツの岩山",
        description: "ごつごつした岩肌と土けむり。力自慢が集まる",
        types: ["rock", "ground", "fighting", "bug"],
      });
    },
  );
});

describe("[本体:採点]翻訳の採点", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      観点: ["エッジケース"],
      steps: [
        {
          Given: NO_QUEST_SESSION,
          When: [CALL_SCORING],
          Then: NOT_FOUND_ERROR,
        },
      ],
    },
    async () => {
      const res = await request(makeApp()).post("/api/quest/score").send({ translation: "生まれたときから背中に不思議なタネが植えられていて、タネは体とともに育つ" });
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "resource not found" });
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      観点: ["外部依存の失敗"],
      steps: [
        {
          Given: "クエストが出題されていて、AI が利用できないとき",
          When: [CALL_SCORING],
          Then: EXTERNAL_SERVICE_UNAVAILABLE_ERROR,
        },
      ],
    },
    async () => {
      const app = makeApp({ llmError: new Error("llm down") });
      await request(app).get("/api/quest/new");
      const res = await request(app).post("/api/quest/score").send({ translation: "生まれたときから背中に不思議なタネが植えられていて、タネは体とともに育つ" });
      expect(res.status).toBe(502);
      expect(res.body).toEqual({ error: "external service unavailable" });
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      観点: ["エッジケース"],
      steps: [
        {
          When: ["翻訳の採点 API に、訳文を指定せずに呼び出す"],
          Then: "API の応答は、訳文が必須であることを示す 400 のエラーになる",
        },
      ],
    },
    async () => {
      const res = await request(makeApp()).post("/api/quest/score").send({});
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "translation is required" });
    },
  );
});

describe("[本体:AI 呼び出し回数]採点の日次上限", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: USER_DAILY_LIMIT,
          When: [CALL_SCORING],
          Then: "API の応答は、ユーザーの日次上限に達したことを示す 429 のエラーになる",
        },
      ],
    },
    async () => {
      const app = makeApp({ rateLimitKind: "user" });
      const res = await request(app).post("/api/quest/score").send({ translation: "生まれたときから背中に不思議なタネが植えられていて、タネは体とともに育つ" });
      expect(res.status).toBe(429);
      expect(res.body.error).toBe("user");
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: USER_DAILY_LIMIT,
          When: [CALL_SCORING],
          Then: "応答のメッセージは「そろそろ　研究に　戻るぞ。また　明日　来てくれ」になる",
        },
      ],
    },
    async () => {
      const app = makeApp({ rateLimitKind: "user" });
      const res = await request(app).post("/api/quest/score").send({ translation: "生まれたときから背中に不思議なタネが植えられていて、タネは体とともに育つ" });
      expect(res.body.message).toBe("そろそろ　研究に　戻るぞ。また　明日　来てくれ");
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: GLOBAL_DAILY_LIMIT,
          When: [CALL_SCORING],
          Then: "API の応答は、全体の日次上限に達したことを示す 429 のエラーになる",
        },
      ],
    },
    async () => {
      const app = makeApp({ rateLimitKind: "global" });
      const res = await request(app).post("/api/quest/score").send({ translation: "生まれたときから背中に不思議なタネが植えられていて、タネは体とともに育つ" });
      expect(res.status).toBe(429);
      expect(res.body.error).toBe("global");
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: GLOBAL_DAILY_LIMIT,
          When: [CALL_SCORING],
          Then: "応答のメッセージは「今日は　たくさんの　トレーナーが　来ているぞ。また　明日　来てくれ」になる",
        },
      ],
    },
    async () => {
      const app = makeApp({ rateLimitKind: "global" });
      const res = await request(app).post("/api/quest/score").send({ translation: "生まれたときから背中に不思議なタネが植えられていて、タネは体とともに育つ" });
      expect(res.body.message).toBe("今日は　たくさんの　トレーナーが　来ているぞ。また　明日　来てくれ");
    },
  );
});

describe("[本体:AI 呼び出し回数]AI 呼び出し回数の記録と取得", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "今日の AI 呼び出し回数が 3 回のとき",
          When: ["AI 呼び出し回数の取得 API を呼び出す"],
          Then: "応答の今日の AI 呼び出し回数は 3 回になる",
        },
      ],
    },
    async () => {
      const res = await request(makeApp()).get("/api/usage");
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(3);
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "日次上限が 30 回のとき",
          When: ["AI 呼び出し回数の取得 API を呼び出す"],
          Then: "応答の日次上限は 30 回になる",
        },
      ],
    },
    async () => {
      const res = await request(makeApp()).get("/api/usage");
      expect(res.status).toBe(200);
      expect(res.body.limit).toBe(30);
    },
  );
});

describe("[本体:クエスト]進行中のクエストの取得", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "クエストが出題され、訳文「生まれたときから背中に不思議なタネが植えられていて、タネは体とともに育つ」の採点が終わっているとき",
          When: [CALL_CURRENT_QUEST],
          Then: "応答の段階は名前当てになる",
        },
      ],
    },
    async () => {
      const app = makeApp();
      await request(app).get("/api/quest/new");
      await request(app).post("/api/quest/score").send({ translation: "生まれたときから背中に不思議なタネが植えられていて、タネは体とともに育つ" });

      const res = await request(app).get("/api/quest/current");
      expect(res.status).toBe(200);
      expect(res.body.phase).toBe("guessing");
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "クエストが出題され、訳文「生まれたときから背中に不思議なタネが植えられていて、タネは体とともに育つ」の採点が終わっているとき",
          When: [CALL_CURRENT_QUEST],
          Then: "応答の訳文は「生まれたときから背中に不思議なタネが植えられていて、タネは体とともに育つ」になる",
        },
      ],
    },
    async () => {
      const app = makeApp();
      await request(app).get("/api/quest/new");
      await request(app).post("/api/quest/score").send({ translation: "生まれたときから背中に不思議なタネが植えられていて、タネは体とともに育つ" });

      const res = await request(app).get("/api/quest/current");
      expect(res.status).toBe(200);
      expect(res.body.user_translation).toBe("生まれたときから背中に不思議なタネが植えられていて、タネは体とともに育つ");
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: NO_QUEST_SESSION,
          When: [CALL_CURRENT_QUEST],
          Then: NOT_FOUND_ERROR,
        },
      ],
    },
    async () => {
      const res = await request(makeApp()).get("/api/quest/current");
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "resource not found" });
    },
  );
});

describe("[本体:名前当て]名前当ての回答", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      観点: ["エッジケース"],
      steps: [
        {
          When: ["名前当ての回答 API に、回答を指定せずに呼び出す"],
          Then: "API の応答は、回答が必須であることを示す 400 のエラーになる",
        },
      ],
    },
    async () => {
      const res = await request(makeApp()).post("/api/quest/guess-name").send({});
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "guess is required" });
    },
  );
});

describe("[本体:名前当て]名前当てのヒント", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "クエストが出題されていて、出題されたポケモンがフシギダネのとき",
          When: [CALL_HINT],
          Then: "応答の出題されたポケモンのタイプは grass と poison になる",
        },
      ],
    },
    async () => {
      const app = makeApp();
      await request(app).get("/api/quest/new");
      const res = await request(app).post("/api/quest/hint").send({});
      expect(res.status).toBe(200);
      expect(res.body.types).toEqual(["grass", "poison"]);
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "クエストが出題されているとき",
          When: [CALL_HINT],
          Then: "応答の残り挑戦回数は 2 回になる",
        },
      ],
    },
    async () => {
      const app = makeApp();
      await request(app).get("/api/quest/new");
      const res = await request(app).post("/api/quest/hint").send({});
      expect(res.status).toBe(200);
      expect(res.body.attempts_remaining).toBe(2);
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      観点: ["境界値"],
      steps: [
        {
          Given: "名前当てに 2 回不正解になっていて、残り挑戦回数が 1 回のとき",
          When: [CALL_HINT],
          Then: INTERNAL_ERROR,
        },
      ],
    },
    async () => {
      const app = makeApp();
      await request(app).get("/api/quest/new");
      await request(app).post("/api/quest/guess-name").send({ guess: "Charmander" });
      await request(app).post("/api/quest/guess-name").send({ guess: "Squirtle" });
      const res = await request(app).post("/api/quest/hint").send({});
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: "internal server error" });
    },
  );
});

describe("[本体:図鑑]図鑑詳細の取得", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      観点: ["エッジケース"],
      steps: [
        {
          When: ["図鑑詳細の取得 API に、図鑑番号「abc」を指定して呼び出す"],
          Then: "API の応答は、図鑑番号が不正であることを示す 400 のエラーになる",
        },
      ],
    },
    async () => {
      const res = await request(makeApp()).get("/api/pokedex/abc");
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "invalid pokemon id" });
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      観点: ["外部依存の失敗"],
      steps: [
        {
          Given: "図鑑番号 1 の記録があり、ポケモンデータが利用できないとき",
          When: ["図鑑詳細の取得 API に、図鑑番号 1 を指定して呼び出す"],
          Then: EXTERNAL_SERVICE_UNAVAILABLE_ERROR,
        },
      ],
    },
    async () => {
      const app = makeApp({
        pokemonError: new Error("pokemon data unavailable"),
        seededUserPokemon: [
          {
            pokemon_id: 1,
            status: "seen",
            total_captures: 0,
            total_encounters: 1,
            last_captured_at: null,
            last_encountered_at: new Date(),
            best_score: 0,
          },
        ],
      });
      const res = await request(app).get("/api/pokedex/1");
      expect(res.status).toBe(502);
      expect(res.body).toEqual({ error: "external service unavailable" });
    },
  );
});

describe("[共通:設定]除外ポケモンの更新", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "出題世代を設定していないとき",
          When: ["除外ポケモンの更新 API に、図鑑番号 7・3・3 を指定して呼び出す", CALL_SETTINGS],
          Then: "設定の取得 API の応答の除外ポケモンは重複が除かれ、昇順の図鑑番号 3・7 になり、出題世代は世代 1〜8 のままになる",
        },
      ],
    },
    async () => {
      const app = makeApp();
      const put = await request(app).put("/api/settings/excluded-pokemon").send({ pokemon_ids: [7, 3, 3] });
      expect(put.status).toBe(200);

      const got = await request(app).get("/api/settings");
      expect(got.status).toBe(200);
      expect(got.body).toEqual({ excluded_pokemon_ids: [3, 7], enabled_generations: [1, 2, 3, 4, 5, 6, 7, 8] });
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      観点: ["エッジケース"],
      steps: [
        {
          When: ["除外ポケモンの更新 API に、文字列「1」を指定して呼び出す"],
          Then: "API の応答は、除外する図鑑番号は一覧で指定する必要があることを示す 400 のエラーになる",
        },
      ],
    },
    async () => {
      const res = await request(makeApp()).put("/api/settings/excluded-pokemon").send({ pokemon_ids: "1" });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "excluded_pokemon_ids must be an array" });
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      観点: ["境界値"],
      steps: [
        {
          Given: "出題可能な図鑑番号が 1 から 100 で、除外ポケモンの件数の上限が 30 件のとき",
          When: ["除外ポケモンの更新 API に、図鑑番号 1 から 31 の 31 件を指定して呼び出す"],
          Then: "API の応答は、除外ポケモンの件数が上限を超えていることを示す 400 のエラーになる",
        },
      ],
    },
    async () => {
      const ids = Array.from({ length: 31 }, (_, i) => i + 1);
      const res = await request(makeApp()).put("/api/settings/excluded-pokemon").send({ pokemon_ids: ids });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "excluded_pokemon_ids exceeds limit (max 30)" });
    },
  );

  for (const id of [0, 101]) {
    defineCase(
      {
        種別: "部品間結合テスト",
        正常異常: "異常系",
        観点: ["境界値"],
        steps: [
          {
            Given: "出題可能な図鑑番号が 1 から 100 のとき",
            When: [`除外ポケモンの更新 API に、図鑑番号 ${id} を指定して呼び出す`],
            Then: "API の応答は、指定した図鑑番号が図鑑に無いことを示す 400 のエラーになる",
          },
        ],
      },
      async () => {
        const res = await request(makeApp()).put("/api/settings/excluded-pokemon").send({ pokemon_ids: [id] });
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: `pokemon id not in pokedex: ${id}` });
      },
    );
  }
});

describe("[共通:設定]出題世代の更新", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "除外ポケモンを設定していないとき",
          When: ["出題世代の更新 API に、世代 3・1・1 を指定して呼び出す", CALL_SETTINGS],
          Then: "設定の取得 API の応答の出題世代は重複が除かれ、昇順の世代 1・3 になり、除外ポケモンは 0 件のままになる",
        },
      ],
    },
    async () => {
      const app = makeApp();
      const put = await request(app).put("/api/settings/generations").send({ generations: [3, 1, 1] });
      expect(put.status).toBe(200);

      const got = await request(app).get("/api/settings");
      expect(got.status).toBe(200);
      expect(got.body).toEqual({ excluded_pokemon_ids: [], enabled_generations: [1, 3] });
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      観点: ["件数・有無"],
      steps: [
        {
          When: ["出題世代の更新 API に、世代を 1 つも指定せずに呼び出す"],
          Then: "API の応答は、1 つ以上の世代の選択が必要なことを示す 400 のエラーになる",
        },
      ],
    },
    async () => {
      const res = await request(makeApp()).put("/api/settings/generations").send({ generations: [] });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "at least one generation must be selected" });
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "異常系",
      観点: ["エッジケース"],
      steps: [
        {
          When: ["出題世代の更新 API に、世代 99 を指定して呼び出す"],
          Then: "API の応答は、世代 99 が存在しないことを示す 400 のエラーになる",
        },
      ],
    },
    async () => {
      const res = await request(makeApp()).put("/api/settings/generations").send({ generations: [99] });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "unknown generation: 99 (must be one of 1,2,3,4,5,6,7,8)" });
    },
  );
});

describe("[本体:チュートリアル]チュートリアル完了状態の取得と記録", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "チュートリアルが未完了のとき",
          When: [CALL_TUTORIAL_STATUS],
          Then: "応答は未完了になる",
        },
      ],
    },
    async () => {
      const res = await request(makeApp()).get("/api/tutorial-status");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ tutorial_completed: false });
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          When: ["チュートリアルの完了の記録 API を呼び出す", CALL_TUTORIAL_STATUS],
          Then: "応答は完了済みになる",
        },
      ],
    },
    async () => {
      const app = makeApp();
      const complete = await request(app).put("/api/tutorial-status/complete");
      expect(complete.status).toBe(200);

      const got = await request(app).get("/api/tutorial-status");
      expect(got.body).toEqual({ tutorial_completed: true });
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          When: [
            "チュートリアルの完了の記録 API を呼び出す",
            "チュートリアルの完了状態のリセット API を呼び出す",
            CALL_TUTORIAL_STATUS,
          ],
          Then: "応答は未完了になる",
        },
      ],
    },
    async () => {
      const app = makeApp();
      await request(app).put("/api/tutorial-status/complete");
      const reset = await request(app).put("/api/tutorial-status/reset");
      expect(reset.status).toBe(200);

      const got = await request(app).get("/api/tutorial-status");
      expect(got.body).toEqual({ tutorial_completed: false });
    },
  );
});

async function makeAppWithTutorialGuessed() {
  const app = makeApp();
  await request(app).get("/api/tutorial/quest/new");
  await request(app).post("/api/tutorial/quest/score").send({ translation: "電気タイプのねずみポケモン" });
  await request(app).post("/api/tutorial/quest/guess-name").send({ guess: "ピカチュウ" });
  return app;
}

describe("[本体:チュートリアル]固定シナリオのクエスト", () => {
  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          When: [CALL_TUTORIAL_QUEST],
          Then: "応答の出題されたポケモンは図鑑番号 25 のピカチュウになる",
        },
      ],
    },
    async () => {
      const res = await request(makeApp()).get("/api/tutorial/quest/new");
      expect(res.status).toBe(200);
      expect(res.body.pokemon_id).toBe(25);
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          When: [CALL_TUTORIAL_QUEST],
          Then: "応答の英文は「It is an Electric-type Mouse Pokémon.」になる",
        },
      ],
    },
    async () => {
      const res = await request(makeApp()).get("/api/tutorial/quest/new");
      expect(res.status).toBe(200);
      expect(res.body.description_en).toBe("It is an Electric-type Mouse Pokémon.");
    },
  );

  for (const { 正常異常, given, overrides } of [
    { 正常異常: "正常系" as const, given: TUTORIAL_QUEST_STARTED, overrides: {} },
    {
      正常異常: "異常系" as const,
      given: "ユーザーの日次上限に達していて、チュートリアルのクエストが出題されているとき",
      overrides: { rateLimitKind: "user" as const },
    },
  ]) {
    defineCase(
      {
        種別: "部品間結合テスト",
        正常異常,
        steps: [{ Given: given, When: [CALL_TUTORIAL_SCORING], Then: "応答の最終評価点は 99 になる" }],
      },
      async () => {
        const app = makeApp(overrides);
        await request(app).get("/api/tutorial/quest/new");
        const res = await request(app).post("/api/tutorial/quest/score").send({ translation: "でたらめ" });
        expect(res.status).toBe(200);
        expect(res.body.score).toBe(99);
      },
    );
  }

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: TUTORIAL_QUEST_STARTED,
          When: ["チュートリアルの名前当ての回答 API に、英語名「pikachu」を指定して呼び出す"],
          Then: "応答は正解を示し、手に入るボールはハイパーボールになる",
        },
      ],
    },
    async () => {
      const app = makeApp();
      await request(app).get("/api/tutorial/quest/new");
      const res = await request(app).post("/api/tutorial/quest/guess-name").send({ guess: "pikachu" });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ correct: true, ball_type: "ultra" });
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: TUTORIAL_QUEST_STARTED,
          When: ["チュートリアルの名前当ての回答 API に、日本語名「ピカチュウ」を指定して呼び出す"],
          Then: "応答は正解を示し、手に入るボールはスーパーボールになる",
        },
      ],
    },
    async () => {
      const app = makeApp();
      await request(app).get("/api/tutorial/quest/new");
      const res = await request(app).post("/api/tutorial/quest/guess-name").send({ guess: "ピカチュウ" });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ correct: true, ball_type: "great" });
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: TUTORIAL_QUEST_ANSWERED,
          When: [CALL_TUTORIAL_CAPTURE],
          Then: "応答は捕獲に成功したことを示す",
        },
      ],
    },
    async () => {
      const app = await makeAppWithTutorialGuessed();

      const res = await request(app).post("/api/tutorial/quest/capture").send({});
      expect(res.status).toBe(200);
      expect(res.body.captured).toBe(true);
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: TUTORIAL_QUEST_ANSWERED,
          When: [CALL_TUTORIAL_CAPTURE, CALL_POKEDEX],
          Then: "図鑑一覧の取得 API の応答のポケモンの一覧は空になる",
        },
      ],
    },
    async () => {
      const app = await makeAppWithTutorialGuessed();
      await request(app).post("/api/tutorial/quest/capture").send({});

      const pokedex = await request(app).get("/api/pokedex");
      expect(pokedex.status).toBe(200);
      expect(pokedex.body.pokemon).toHaveLength(0);
    },
  );

  defineCase(
    {
      種別: "部品間結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: TUTORIAL_QUEST_ANSWERED,
          When: [CALL_TUTORIAL_CAPTURE, CALL_POKEDEX],
          Then: "図鑑一覧の取得 API の応答の捕獲数は 0 になる",
        },
      ],
    },
    async () => {
      const app = await makeAppWithTutorialGuessed();
      await request(app).post("/api/tutorial/quest/capture").send({});

      const pokedex = await request(app).get("/api/pokedex");
      expect(pokedex.status).toBe(200);
      expect(pokedex.body.captured_count).toBe(0);
    },
  );
});
