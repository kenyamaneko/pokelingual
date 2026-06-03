import express from "express";
import { VertexAI } from "@google-cloud/vertexai";
import { Firestore } from "@google-cloud/firestore";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

import { loadConfig } from "./config/config.js";
import { corsConfig } from "./middleware/cors.js";
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
import { ChatService } from "./service/chat-service.js";
import { CollectionService } from "./service/collection-service.js";
import { UserPokemonRepo } from "./adapter/firestore/user-pokemon-repo.js";
import { UserSettingsRepo } from "./adapter/firestore/user-settings-repo.js";
import { RateLimitRepo } from "./adapter/firestore/rate-limit-repo.js";
import { QuestHandler } from "./handler/quest-handler.js";
import { CollectionHandler } from "./handler/collection-handler.js";
import { SettingsHandler } from "./handler/settings-handler.js";
import { UsageHandler } from "./handler/usage-handler.js";
import { setupRoutes } from "./router/router.js";
import type {
  LLMClient,
  PokemonClient,
  PokemonConfig,
  RandomSource,
  UserPokemonRepository,
  UserSettingsRepository,
  RateLimitRepository,
} from "./domain/ports.js";
import type { RequestHandler } from "express";

/** Firestore の config/app ドキュメントから PokemonConfig を読み込む。未設定ならデフォルト値。 */
const DEFAULT_POKEMON_CONFIG: PokemonConfig = {
  maxPokemonID: 898,
  defaultExcludedPokemonIDs: [167, 168, 595, 596, 751, 752],
};

async function loadPokemonConfig(
  firestoreClient: ReturnType<typeof getFirestore>,
): Promise<PokemonConfig> {
  const doc = await firestoreClient.collection("config").doc("app").get();
  if (!doc.exists) return DEFAULT_POKEMON_CONFIG;
  const data = doc.data();
  const maxPokemonID = typeof data?.max_pokemon_id === "number"
    ? data.max_pokemon_id
    : DEFAULT_POKEMON_CONFIG.maxPokemonID;
  const defaultExcludedPokemonIDs = Array.isArray(data?.default_excluded_pokemon_ids)
    ? (data.default_excluded_pokemon_ids as number[])
    : DEFAULT_POKEMON_CONFIG.defaultExcludedPokemonIDs;
  return { maxPokemonID, defaultExcludedPokemonIDs };
}

const cfg = loadConfig();

let pokemonClient: PokemonClient;
let llmClient: LLMClient;
let randomSource: RandomSource;
let pokemonConfig: PokemonConfig;
let userPokemonRepo: UserPokemonRepository;
let userSettingsRepo: UserSettingsRepository;
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
  console.log(`Starting in mock mode (Firestore Emulator: ${process.env.FIRESTORE_EMULATOR_HOST})`);
  const firestoreClient = new Firestore({ projectId: cfg.gcpProject });
  pokemonClient = new MockPokemonClient();
  llmClient = new MockLLMClient();
  randomSource = new MockRandomSource();
  pokemonConfig = DEFAULT_POKEMON_CONFIG;
  userPokemonRepo = new UserPokemonRepo(firestoreClient);
  userSettingsRepo = new UserSettingsRepo(firestoreClient);
  rateLimitRepo = new RateLimitRepo(firestoreClient, cfg.perUserDailyLimit, cfg.globalDailyLimit);
  authMiddleware = devAuth();
} else {
  const firebaseApp = initializeApp({
    credential: applicationDefault(),
  });
  const authClient = getAuth(firebaseApp);
  const firestoreClient = getFirestore(firebaseApp);

  const vertexAI = new VertexAI({
    project: cfg.gcpProject,
    location: cfg.gcpLocation,
  });

  // ホワイトリストは config/auth.allowed_emails で運用。
  // 空配列 or ドキュメント不在は「公開モード（誰でも認証通過後にアクセス可）」として明示的に許容する
  const configDoc = await firestoreClient.collection("config").doc("auth").get();
  const allowedEmails: string[] = configDoc.exists
    ? (configDoc.data()?.allowed_emails as string[]) ?? []
    : [];
  if (allowedEmails.length === 0) {
    console.warn("config/auth.allowed_emails is empty — running in PUBLIC mode (any authenticated user allowed)");
  } else {
    console.log(`Loaded ${allowedEmails.length} allowed email(s) from Firestore (whitelist mode)`);
  }

  pokemonConfig = await loadPokemonConfig(firestoreClient);
  console.log(
    `Loaded Pokemon config: maxPokemonID=${pokemonConfig.maxPokemonID}, ` +
      `defaultExcluded=${pokemonConfig.defaultExcludedPokemonIDs.length}`,
  );
  pokemonClient = new PokeAPIClient(pokemonConfig);
  llmClient = new GeminiClient(vertexAI);
  randomSource = new SystemRandomSource();
  userPokemonRepo = new UserPokemonRepo(firestoreClient);
  userSettingsRepo = new UserSettingsRepo(firestoreClient);
  rateLimitRepo = new RateLimitRepo(firestoreClient, cfg.perUserDailyLimit, cfg.globalDailyLimit);
  authMiddleware = firebaseAuth(authClient, allowedEmails);
}

console.log(`Rate limits: per-user=${cfg.perUserDailyLimit}/day, global=${cfg.globalDailyLimit}/day`);

const questService = new QuestService(pokemonClient, llmClient, pokemonConfig, userSettingsRepo, randomSource);
const chatService = new ChatService(llmClient);
const collectionService = new CollectionService(userPokemonRepo, pokemonClient);

const questHandler = new QuestHandler(questService, chatService, userPokemonRepo);
const collectionHandler = new CollectionHandler(collectionService, userSettingsRepo, pokemonConfig);
const settingsHandler = new SettingsHandler(userSettingsRepo, pokemonConfig);
const usageHandler = new UsageHandler(rateLimitRepo);

const app = express();
app.use(express.json());
app.use(corsConfig(cfg.frontendURL));

const rateLimitMiddleware = rateLimit(rateLimitRepo);
const apiRouter = setupRoutes(
  authMiddleware,
  rateLimitMiddleware,
  questHandler,
  collectionHandler,
  settingsHandler,
  usageHandler,
);
app.use("/api", apiRouter);

app.listen(parseInt(cfg.port), () => {
  console.log(`Starting server on :${cfg.port}`);
});
