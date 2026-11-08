import { describe, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { GenericContainer, type StartedTestContainer } from "testcontainers";
import { Redis } from "ioredis";
import express from "express";
import request from "supertest";
import { RedisQuestSessionStore } from "./redis.js";
import { QuestService } from "../../service/quest-service.js";
import { PokedexService } from "../../service/pokedex-service.js";
import { SettingsService } from "../../service/settings-service.js";
import { QuestHandler } from "../../handler/quest-handler.js";
import { PokedexHandler } from "../../handler/pokedex-handler.js";
import { SettingsHandler } from "../../handler/settings-handler.js";
import { UsageHandler } from "../../handler/usage-handler.js";
import { TutorialHandler } from "../../handler/tutorial-handler.js";
import { createTutorialQuestHandler } from "../../composition/tutorial-quest.js";
import { UserPokemonRepo } from "../repository/user-pokemon-repo.js";
import { UserSettingsRepo } from "../repository/user-settings-repo.js";
import { UserRepo } from "../repository/user-repo.js";
import { RateLimitRepo } from "../repository/rate-limit-repo.js";
import {
  requireFirestoreEmulator,
  clearFirestoreEmulator,
} from "../repository/firestore-emulator-helper.js";
import { setupRoutes } from "../../router/router.js";
import { devAuth } from "../../middleware/auth-mock.js";
import { rateLimit } from "../../middleware/rate-limit.js";
import { makePokemon, makePokemonClient } from "../../testing/pokemon-fixtures.js";
import { DEFAULT_QUEST_TUNING } from "../../testing/quest-tuning-fixture.js";
import { DEFAULT_MAX_EXCLUDED_POKEMON_COUNT } from "../../testing/settings-fixture.js";
import type { LLMClient, QuestSessionStore, RandomSource } from "../../domain/ports.js";
import type { QuestSession } from "../../domain/quest.js";
import { defineCase } from "../../test/defineCase.js";

const VALKEY_IMAGE = "valkey/valkey:8-alpine";
const VALKEY_PORT = 6379;
const USER_RATE_LIMIT = 30;
const GLOBAL_RATE_LIMIT = 1500;

const db = requireFirestoreEmulator();

let container: StartedTestContainer;
let redisURL: string;

beforeAll(async () => {
  container = await new GenericContainer(VALKEY_IMAGE).withExposedPorts(VALKEY_PORT).start();
  redisURL = `redis://${container.getHost()}:${container.getMappedPort(VALKEY_PORT)}`;
});

afterAll(async () => {
  await container.stop();
});

function makeSession(overrides: Partial<QuestSession> = {}): QuestSession {
  return {
    pokemon_id: 1,
    description_en: "A strange seed was planted on its back at birth. The plant sprouts and grows with this Pokémon.",
    description_ja: "生まれたときから　背中に 不思議な　タネが　植えてあって 体と　ともに　育つという。",
    name_en: "Bulbasaur",
    name_ja: "フシギダネ",
    sprite_url: "https://example.com/1.png",
    base_stat_total: 318,
    types: ["grass", "poison"],
    height: 7,
    weight: 69,
    is_legendary: false,
    is_mythical: false,
    score: 0,
    ball_type: null,
    guess_attempts: 0,
    name_guessed: false,
    hint_reveal_count: 0,
    ...overrides,
  };
}

function buildAppInstance(sessionStore: QuestSessionStore, tutorialSessionStore: QuestSessionStore) {
  const pokemonClient = makePokemonClient([makePokemon()]);
  const llm: LLMClient = {
    generateText: async () => JSON.stringify({ units: [0.7], review: "よい 翻訳だ。" }),
  };
  const servablePokemonIDs = new Set(Array.from({ length: 100 }, (_, i) => i + 1));
  const random: RandomSource = { next: () => 0 };
  const userPokemonRepo = new UserPokemonRepo(db);
  const settingsRepo = new UserSettingsRepo(db);
  const userRepo = new UserRepo(db);
  const rateLimitRepo = new RateLimitRepo(db, USER_RATE_LIMIT, GLOBAL_RATE_LIMIT);

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


const openClients: Redis[] = [];

afterEach(async () => {
  await Promise.all(openClients.splice(0).map((client) => client.quit()));
});

function connectRedis(): Redis {
  const client = new Redis(redisURL);
  openClients.push(client);
  return client;
}

function buildTwoInstances(keyPrefix: string) {
  const clientA = connectRedis();
  const clientB = connectRedis();
  return {
    instanceA: buildAppInstance(
      new RedisQuestSessionStore(clientA, `${keyPrefix}quest:`, 60),
      new RedisQuestSessionStore(clientA, `${keyPrefix}tutorial:`, 60),
    ),
    instanceB: buildAppInstance(
      new RedisQuestSessionStore(clientB, `${keyPrefix}quest:`, 60),
      new RedisQuestSessionStore(clientB, `${keyPrefix}tutorial:`, 60),
    ),
  };
}

async function playQuestToCaptureAlternatingInstances(keyPrefix: string) {
  const { instanceA, instanceB } = buildTwoInstances(keyPrefix);

  const quest = await request(instanceA).get("/api/quest/new?location=sunlit-forest");
  expect(quest.status).toBe(200);

  const score = await request(instanceB).post("/api/quest/score").send({ translation: "生まれたときから背中に不思議なタネが植えられていて、タネは体とともに育つ" });
  expect(score.status).toBe(200);

  const guess = await request(instanceA).post("/api/quest/guess-name").send({ guess: "Charmander" });
  expect(guess.status).toBe(200);

  const skip = await request(instanceB).post("/api/quest/skip-guess").send({});
  expect(skip.status).toBe(200);

  const capture = await request(instanceA).post("/api/quest/capture").send({});
  expect(capture.status).toBe(200);
  return { skip, capture };
}

async function getCurrentQuestOnOtherInstanceAfterScore(keyPrefix: string) {
  const { instanceA, instanceB } = buildTwoInstances(keyPrefix);

  await request(instanceA).get("/api/quest/new?location=sunlit-forest");
  await request(instanceA).post("/api/quest/score").send({ translation: "生まれたときから背中に不思議なタネが植えられていて、タネは体とともに育つ" });

  const current = await request(instanceB).get("/api/quest/current");
  expect(current.status).toBe(200);
  return current;
}

describe("[本体:クエスト]セッションの保存・取得・削除", () => {
  defineCase(
    {
      種別: "インフラ結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "セッションが一度も保存されていないユーザーがいるとき",
          When: ["クエストのセッションの保存先から、そのユーザーのセッションを取得する"],
          Then: "セッションは見つからない",
        },
      ],
    },
    async () => {
      const store = new RedisQuestSessionStore(connectRedis(), "test:missing:", 60);

      expect(await store.get("nobody")).toBeNull();
    },
  );

  defineCase(
    {
      種別: "インフラ結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "セッションの有効期間が 60 秒に設定されているとき",
          When: ["クエストのセッションの保存先に、セッションを保存する"],
          Then: "保存直後の残り有効期間は 0 秒より大きく、60 秒以下になる",
        },
      ],
    },
    async () => {
      const client = connectRedis();
      const store = new RedisQuestSessionStore(client, "test:ttl:", 60);

      await store.set("alice", makeSession());
      const ttl = await client.ttl("test:ttl:alice");

      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(60);
    },
  );

  defineCase(
    {
      種別: "インフラ結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "セッションが保存されているユーザーがいるとき",
          When: [
            "クエストのセッションの保存先から、そのユーザーのセッションを削除する",
            "クエストのセッションの保存先から、そのユーザーのセッションを取得する",
          ],
          Then: "セッションは見つからない",
        },
      ],
    },
    async () => {
      const store = new RedisQuestSessionStore(connectRedis(), "test:delete:", 60);
      await store.set("alice", makeSession());

      await store.delete("alice");

      expect(await store.get("alice")).toBeNull();
    },
  );
});

const QUEST_NEW_ON_INSTANCE_A = "インスタンス A のクエストの出題 API を呼び出す";
const SCORE_ON_INSTANCE_A = "インスタンス A の翻訳の採点 API に、訳文「生まれたときから背中に不思議なタネが植えられていて、タネは体とともに育つ」を指定して呼び出す";
const SCORE_ON_INSTANCE_B = "インスタンス B の翻訳の採点 API に、訳文「生まれたときから背中に不思議なタネが植えられていて、タネは体とともに育つ」を指定して呼び出す";
const CURRENT_QUEST_ON_INSTANCE_B = "インスタンス B の進行中のクエストの取得 API を呼び出す";

const ALTERNATING_INSTANCES_OPERATIONS = [
  QUEST_NEW_ON_INSTANCE_A,
  SCORE_ON_INSTANCE_B,
  "インスタンス A の名前当ての回答 API に、回答「Charmander」を指定して呼び出す",
  "インスタンス B の名前当てのスキップ API を呼び出す",
  "インスタンス A の捕獲 API を呼び出す",
] as const;

const BULBASAUR_ONLY = "出題されるポケモンがフシギダネだけのとき";

describe("[本体:クエスト]インスタンス間でのセッションの引き継ぎ", () => {
  beforeEach(clearFirestoreEmulator);

  defineCase(
    {
      種別: "インフラ結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: BULBASAUR_ONLY,
          When: ALTERNATING_INSTANCES_OPERATIONS,
          Then: "名前当てのスキップ API の応答のボールも、捕獲 API の応答のボールも、モンスターボールになる",
        },
      ],
    },
    async () => {
      const { skip, capture } = await playQuestToCaptureAlternatingInstances("test:handoff:ball:");

      expect(skip.body).toEqual({ ball_type: "poke" });
      expect(capture.body).toMatchObject({ ball_type: "poke" });
    },
  );

  defineCase(
    {
      種別: "インフラ結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: BULBASAUR_ONLY,
          When: ALTERNATING_INSTANCES_OPERATIONS,
          Then: "捕獲 API の応答のポケモンの図鑑番号は 1 になる",
        },
      ],
    },
    async () => {
      const { capture } = await playQuestToCaptureAlternatingInstances("test:handoff:pokemon:");

      expect(capture.body).toMatchObject({ pokemon_id: 1 });
    },
  );

  defineCase(
    {
      種別: "インフラ結合テスト",
      正常異常: "正常系",
      steps: [
        {
          When: [QUEST_NEW_ON_INSTANCE_A, SCORE_ON_INSTANCE_A, CURRENT_QUEST_ON_INSTANCE_B],
          Then: "進行中のクエストの取得 API の応答の段階は名前当てになる",
        },
      ],
    },
    async () => {
      const current = await getCurrentQuestOnOtherInstanceAfterScore("test:resume:phase:");

      expect(current.body).toMatchObject({ phase: "guessing" });
    },
  );

  defineCase(
    {
      種別: "インフラ結合テスト",
      正常異常: "正常系",
      steps: [
        {
          When: [QUEST_NEW_ON_INSTANCE_A, SCORE_ON_INSTANCE_A, CURRENT_QUEST_ON_INSTANCE_B],
          Then: "進行中のクエストの取得 API の応答の訳文は「生まれたときから背中に不思議なタネが植えられていて、タネは体とともに育つ」になる",
        },
      ],
    },
    async () => {
      const current = await getCurrentQuestOnOtherInstanceAfterScore("test:resume:translation:");

      expect(current.body).toMatchObject({ user_translation: "生まれたときから背中に不思議なタネが植えられていて、タネは体とともに育つ" });
    },
  );
});
