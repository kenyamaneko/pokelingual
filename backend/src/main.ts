import express from "express";
import { VertexAI } from "@google-cloud/vertexai";
import { Firestore } from "@google-cloud/firestore";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

import { loadConfig } from "./config/config.js";
import { logger } from "./util/logger.js";
import { createCorsMiddleware } from "./middleware/cors.js";
import { firebaseAuth } from "./middleware/auth.js";
import { rateLimit } from "./middleware/rate-limit.js";
import { devAuth } from "./middleware/auth-mock.js";
import { MockLLMClient } from "./adapter/llm/mock.js";
import { GeminiClient } from "./adapter/llm/gemini.js";
import { MockPokemonClient } from "./adapter/pokemon/mock.js";
import { PokeAPIClient } from "./adapter/pokemon/pokeapi.js";
import { SystemRandomSource } from "./adapter/random/system.js";
import { MockRandomSource } from "./adapter/random/mock.js";
import { QuestService } from "./service/quest-service.js";
import { PokedexService } from "./service/pokedex-service.js";
import { UserPokemonRepo } from "./adapter/repository/user-pokemon-repo.js";
import { UserSettingsRepo } from "./adapter/repository/user-settings-repo.js";
import { UserRepo } from "./adapter/repository/user-repo.js";
import { RateLimitRepo } from "./adapter/repository/rate-limit-repo.js";
import { QuestHandler } from "./handler/quest-handler.js";
import { PokedexHandler } from "./handler/pokedex-handler.js";
import { SettingsHandler } from "./handler/settings-handler.js";
import { UsageHandler } from "./handler/usage-handler.js";
import { TutorialHandler } from "./handler/tutorial-handler.js";
import { setupRoutes } from "./router/router.js";
import type {
  LLMClient,
  PokemonClient,
  PokemonConfig,
  RandomSource,
  UserPokemonRepository,
  UserSettingsRepository,
  UserRepository,
  RateLimitRepository,
} from "./domain/ports.js";
import type { RequestHandler } from "express";

const cfg = loadConfig();

let pokemonClient: PokemonClient;
let llmClient: LLMClient;
let randomSource: RandomSource;
let pokemonConfig: PokemonConfig;
let userPokemonRepo: UserPokemonRepository;
let userSettingsRepo: UserSettingsRepository;
let userRepo: UserRepository;
let rateLimitRepo: RateLimitRepository;
let authMiddleware: RequestHandler;

if (cfg.appMode === "mock") {
  // mock モード: 外部 API (PokeAPI / Gemini / Firebase Auth) はモック差し替え、
  // 永続化は Firestore Emulator (FIRESTORE_EMULATOR_HOST が指す) を介して本番 Repo を使う。
  // ローカル実装と本番実装の挙動ドリフトを Repo 層で発生させないための構成。
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error(
      "FIRESTORE_EMULATOR_HOST must be set in mock mode " +
        "(docker-compose では firestore-emulator サービスが提供する)",
    );
  }
  logger.info("starting in mock mode", { firestore_emulator: process.env.FIRESTORE_EMULATOR_HOST });
  const firestoreClient = new Firestore({ projectId: cfg.googleCloudProject });
  randomSource = new MockRandomSource();
  pokemonClient = new MockPokemonClient();
  llmClient = new MockLLMClient();
  pokemonConfig = { maxPokemonID: cfg.maxPokemonID, environment: cfg.environment };
  userPokemonRepo = new UserPokemonRepo(firestoreClient);
  userSettingsRepo = new UserSettingsRepo(firestoreClient);
  userRepo = new UserRepo(firestoreClient);
  rateLimitRepo = new RateLimitRepo(firestoreClient, cfg.perUserDailyLimit, cfg.globalDailyLimit);
  authMiddleware = devAuth();
} else {
  const firebaseApp = initializeApp({
    credential: applicationDefault(),
  });
  const authClient = getAuth(firebaseApp);
  const firestoreClient = getFirestore(firebaseApp);

  const vertexAI = new VertexAI({
    project: cfg.googleCloudProject,
    location: cfg.googleCloudLocation,
  });

  pokemonConfig = { maxPokemonID: cfg.maxPokemonID, environment: cfg.environment };
  randomSource = new SystemRandomSource();
  pokemonClient = new PokeAPIClient(pokemonConfig, (url) => fetch(url));
  llmClient = new GeminiClient(vertexAI, cfg.geminiModel);
  userPokemonRepo = new UserPokemonRepo(firestoreClient);
  userSettingsRepo = new UserSettingsRepo(firestoreClient);
  userRepo = new UserRepo(firestoreClient);
  rateLimitRepo = new RateLimitRepo(firestoreClient, cfg.perUserDailyLimit, cfg.globalDailyLimit);
  authMiddleware = firebaseAuth(authClient);
}

logger.info("rate limits configured", {
  per_user_daily_limit: cfg.perUserDailyLimit,
  global_daily_limit: cfg.globalDailyLimit,
});

const questService = new QuestService(pokemonClient, llmClient, pokemonConfig, userSettingsRepo, randomSource);
const pokedexService = new PokedexService(userPokemonRepo, pokemonClient, userSettingsRepo, pokemonConfig);

const questHandler = new QuestHandler(questService, userPokemonRepo);
const pokedexHandler = new PokedexHandler(pokedexService);
const settingsHandler = new SettingsHandler(userSettingsRepo, pokemonConfig);
const usageHandler = new UsageHandler(rateLimitRepo);
const tutorialHandler = new TutorialHandler(userRepo);

const app = express();
app.use(express.json());
app.use(createCorsMiddleware(cfg.frontendURL));

// ヘルスチェック (認証不要)。docker compose の healthcheck と CI の起動待ちが叩く
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const rateLimitMiddleware = rateLimit(rateLimitRepo);
const apiRouter = setupRoutes(
  authMiddleware,
  rateLimitMiddleware,
  questHandler,
  pokedexHandler,
  settingsHandler,
  usageHandler,
  tutorialHandler,
);
app.use("/api", apiRouter);

app.listen(parseInt(cfg.port), () => {
  logger.info("starting server", { port: cfg.port });
});
