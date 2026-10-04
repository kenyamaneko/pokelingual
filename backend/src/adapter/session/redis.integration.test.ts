import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
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
import { setupRoutes } from "../../router/router.js";
import { devAuth } from "../../middleware/auth-mock.js";
import { rateLimit } from "../../middleware/rate-limit.js";
import { makePokemon, makePokemonClient } from "../../testing/pokemon-fixtures.js";
import { DEFAULT_QUEST_TUNING } from "../../testing/quest-tuning-fixture.js";
import { DEFAULT_MAX_EXCLUDED_POKEMON_COUNT } from "../../testing/settings-fixture.js";
import type {
  LLMClient,
  QuestSessionStore,
  RandomSource,
  RateLimitRepository,
  UserPokemonRepository,
  UserRepository,
  UserSettingsRepository,
} from "../../domain/ports.js";
import type { QuestSession } from "../../domain/quest.js";

const VALKEY_IMAGE = "valkey/valkey:8-alpine";
const VALKEY_PORT = 6379;

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
    description_en: "A strange seed.",
    description_ja: "説明",
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
  const userPokemonRepo: UserPokemonRepository = {
    upsertEncounter: async () => {},
    getPokedex: async () => [],
    getPokemon: async () => {
      throw new Error("not used in this test");
    },
  };
  const settingsRepo: UserSettingsRepository = {
    getSettings: async () => ({ excluded_pokemon_ids: null, enabled_generations: null }),
    updateExcludedPokemon: async () => {},
    updateEnabledGenerations: async () => {},
  };
  const userRepo: UserRepository = {
    getUser: async () => ({ tutorial_completed: false }),
    markTutorialCompleted: async () => {},
  };
  const rateLimitRepo: RateLimitRepository = {
    checkAndIncrement: async () => ({ count: 1, limit: 30 }),
    getUserUsage: async () => ({ count: 1, limit: 30 }),
  };

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
  // プロセス内の参照共有ではなく Valkey 経由でセッションが引き継がれることを確かめるため、Cloud Run の別プロセスを模して、インスタンスごとに Redis クライアントとセッションストアを別オブジェクトにする。
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

  const quest = await request(instanceA).get("/api/quest/new");
  expect(quest.status).toBe(200);

  const score = await request(instanceB).post("/api/quest/score").send({ translation: "はやい" });
  expect(score.status).toBe(200);

  const guess = await request(instanceA).post("/api/quest/guess-name").send({ guess: "wrong" });
  expect(guess.status).toBe(200);

  const skip = await request(instanceB).post("/api/quest/skip-guess").send({});
  expect(skip.status).toBe(200);
  expect(skip.body).toEqual({ ball_type: "poke" });

  const capture = await request(instanceA).post("/api/quest/capture").send({});
  expect(capture.status).toBe(200);
  return capture;
}

async function getCurrentQuestOnOtherInstanceAfterScore(keyPrefix: string) {
  const { instanceA, instanceB } = buildTwoInstances(keyPrefix);

  await request(instanceA).get("/api/quest/new");
  await request(instanceA).post("/api/quest/score").send({ translation: "はやい" });

  const current = await request(instanceB).get("/api/quest/current");
  expect(current.status).toBe(200);
  return current;
}

describe("[クエストセッション] セッションの保存・取得・削除", () => {
  describe("正常系", () => {
    it("セッションを一度も保存していないユーザーのセッションを取得すると、セッションは見つからない", async () => {
      const store = new RedisQuestSessionStore(connectRedis(), "test:missing:", 60);

      expect(await store.get("nobody")).toBeNull();
    });

    it("有効期限を設定してセッションを保存すると、保存直後の残り有効期間は 0 秒より大きく、設定した有効期限以下になる", async () => {
      const client = connectRedis();
      const store = new RedisQuestSessionStore(client, "test:ttl:", 60);

      await store.set("alice", makeSession());
      const ttl = await client.ttl("test:ttl:alice");

      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(60);
    });

    it("セッションを保存したユーザーのセッションを削除した後に取得すると、セッションは見つからない", async () => {
      const store = new RedisQuestSessionStore(connectRedis(), "test:delete:", 60);
      await store.set("alice", makeSession());

      await store.delete("alice");

      expect(await store.get("alice")).toBeNull();
    });
  });
});

describe("[クエストセッション] インスタンス間でのセッションの引き継ぎ", () => {
  describe("正常系", () => {
    describe("出題から捕獲までの各操作のリクエストが、2 つのインスタンスに交互に届くとき", () => {
      it("名前当てをスキップすると、捕獲結果のボールはモンスターボールになる", async () => {
        const capture = await playQuestToCaptureAlternatingInstances("test:handoff:ball:");

        expect(capture.body).toMatchObject({ ball_type: "poke" });
      });

      it("捕獲結果のポケモンは、出題されたポケモンになる", async () => {
        const capture = await playQuestToCaptureAlternatingInstances("test:handoff:pokemon:");

        expect(capture.body).toMatchObject({ pokemon_id: 1 });
      });
    });

    describe("採点した後に、採点とは別のインスタンスで現在のクエストを取得するとき", () => {
      it("現在のクエストは、名前当ての段階として得られる", async () => {
        const current = await getCurrentQuestOnOtherInstanceAfterScore("test:resume:phase:");

        expect(current.body).toMatchObject({ phase: "guessing" });
      });

      it("現在のクエストは、採点時に入力した訳文とともに得られる", async () => {
        const current = await getCurrentQuestOnOtherInstanceAfterScore("test:resume:translation:");

        expect(current.body).toMatchObject({ user_translation: "はやい" });
      });
    });
  });
});
