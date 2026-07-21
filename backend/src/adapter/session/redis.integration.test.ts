import { describe, it, expect, beforeAll, afterAll } from "vitest";
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

/**
 * テスト用のクエストセッションを作る。
 * @param overrides 上書きするフィールド。
 * @returns クエストセッション。
 */
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

describe("クエストセッションの永続化 (Valkey)", () => {
  it("セッションを保存していない状態で取得すると、null が返る", async () => {
    const client = new Redis(redisURL);
    const store = new RedisQuestSessionStore(client, "test:missing:", 60);

    expect(await store.get("nobody")).toBeNull();
    await client.quit();
  });

  it("TTL を 60 秒に設定してセッションを保存すると、TTL が 60 秒以下の正の値になる", async () => {
    const client = new Redis(redisURL);
    const store = new RedisQuestSessionStore(client, "test:ttl:", 60);

    await store.set("alice", makeSession());
    const ttl = await client.ttl("test:ttl:alice");

    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(60);
    await client.quit();
  });

  it("保存済みのセッションを削除すると、取得できなくなる", async () => {
    const client = new Redis(redisURL);
    const store = new RedisQuestSessionStore(client, "test:delete:", 60);
    await store.set("alice", makeSession());

    await store.delete("alice");

    expect(await store.get("alice")).toBeNull();
    await client.quit();
  });
});

/**
 * 指定したセッションストアで、公開入口 (HTTP) から叩ける Express アプリを組み立てる。
 * Cloud Run の 1 インスタンスを模す。
 * @param sessionStore 本番クエスト用のセッションストア。
 * @param tutorialSessionStore チュートリアル用のセッションストア。
 * @returns supertest で叩ける Express アプリ。
 */
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

describe("クエストセッションのインスタンス間引き継ぎ (Valkey)", () => {
  it("別インスタンスへリクエストが分散しても、出題から捕獲まで通り、スキップで確定したボール種別が捕獲結果に引き継がれる", async () => {
    // instanceA/B は Redis クライアントもセッションストアも別オブジェクトにし、Cloud Run の
    // 別プロセスを模す。両者が JS オブジェクトを一切共有しないことで、セッションの引き継ぎが
    // プロセス内の参照共有ではなく Valkey 経由であることを保証する。
    const clientA = new Redis(redisURL);
    const clientB = new Redis(redisURL);
    const instanceA = buildAppInstance(
      new RedisQuestSessionStore(clientA, "test:handoff:quest:", 60),
      new RedisQuestSessionStore(clientA, "test:handoff:tutorial:", 60),
    );
    const instanceB = buildAppInstance(
      new RedisQuestSessionStore(clientB, "test:handoff:quest:", 60),
      new RedisQuestSessionStore(clientB, "test:handoff:tutorial:", 60),
    );

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
    expect(capture.body).toMatchObject({ ball_type: "poke", pokemon_id: 1 });

    await clientA.quit();
    await clientB.quit();
  });

  it("採点済みのセッションは別インスタンスに分散しても、現在のクエストを取得すると名前当ての段階として復元される", async () => {
    const clientA = new Redis(redisURL);
    const clientB = new Redis(redisURL);
    const instanceA = buildAppInstance(
      new RedisQuestSessionStore(clientA, "test:resume:quest:", 60),
      new RedisQuestSessionStore(clientA, "test:resume:tutorial:", 60),
    );
    const instanceB = buildAppInstance(
      new RedisQuestSessionStore(clientB, "test:resume:quest:", 60),
      new RedisQuestSessionStore(clientB, "test:resume:tutorial:", 60),
    );

    await request(instanceA).get("/api/quest/new");
    await request(instanceA).post("/api/quest/score").send({ translation: "はやい" });

    const current = await request(instanceB).get("/api/quest/current");

    expect(current.status).toBe(200);
    expect(current.body).toMatchObject({ phase: "guessing", user_translation: "はやい" });

    await clientA.quit();
    await clientB.quit();
  });
});
