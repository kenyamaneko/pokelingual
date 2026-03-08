import express from "express";
import { VertexAI } from "@google-cloud/vertexai";
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

import { loadConfig } from "./config/config.js";
import { corsConfig } from "./middleware/cors.js";
import { firebaseAuth } from "./middleware/auth.js";
import { devAuth } from "./devmock/auth.js";
import { MockAIScorer } from "./devmock/ai-scorer.js";
import { MockPokemonFetcher } from "./devmock/pokemon-fetcher.js";
import { MockUserPokemonRepo } from "./devmock/user-pokemon-repo.js";
import { MockUserSettingsRepo } from "./devmock/user-settings-repo.js";
import { GeminiService } from "./service/gemini-service.js";
import { PokeAPIService, setMaxPokemonID, setDefaultExcludedPokemonIDs } from "./service/pokeapi-service.js";
import { QuestService } from "./service/quest-service.js";
import { CollectionService } from "./service/collection-service.js";
import { UserPokemonRepo } from "./repository/user-pokemon-repo.js";
import { UserSettingsRepo } from "./repository/user-settings-repo.js";
import { QuestHandler } from "./handler/quest-handler.js";
import { CollectionHandler } from "./handler/collection-handler.js";
import { SettingsHandler } from "./handler/settings-handler.js";
import { setupRoutes } from "./router/router.js";
import type { AIScorer, PokemonFetcher, UserPokemonRepository, UserSettingsRepository } from "./domain/interfaces.js";
import type { RequestHandler } from "express";

const cfg = loadConfig();

let pokemonFetcher: PokemonFetcher;
let aiScorer: AIScorer;
let userPokemonRepo: UserPokemonRepository;
let userSettingsRepo: UserSettingsRepository;
let authMiddleware: RequestHandler;

if (cfg.appMode === "mock") {
  console.log("Starting in mock mode with devmock services");
  pokemonFetcher = new MockPokemonFetcher();
  aiScorer = new MockAIScorer();
  userPokemonRepo = new MockUserPokemonRepo();
  userSettingsRepo = new MockUserSettingsRepo();
  authMiddleware = devAuth();
} else {
  // Initialize Firebase
  const firebaseApp = initializeApp({
    credential: applicationDefault(),
  });
  const authClient = getAuth(firebaseApp);
  const firestoreClient = getFirestore(firebaseApp);

  // Initialize Gemini (Vertex AI)
  const vertexAI = new VertexAI({
    project: cfg.gcpProject,
    location: cfg.gcpLocation,
  });

  // Read allowed emails from Firestore
  const configDoc = await firestoreClient.collection("config").doc("auth").get();
  if (!configDoc.exists) {
    console.error("config/auth document not found in Firestore");
    process.exit(1);
  }
  const allowedEmails: string[] = (configDoc.data()?.allowed_emails as string[]) ?? [];
  if (allowedEmails.length === 0) {
    console.error("config/auth has no allowed_emails configured — refusing to start");
    process.exit(1);
  }
  console.log(`Loaded ${allowedEmails.length} allowed email(s) from Firestore`);

  // Read app config from Firestore
  const appConfigDoc = await firestoreClient.collection("config").doc("app").get();
  if (appConfigDoc.exists) {
    const data = appConfigDoc.data();
    if (data?.max_pokemon_id) {
      setMaxPokemonID(data.max_pokemon_id as number);
      console.log(`Loaded MaxPokemonID=${data.max_pokemon_id} from Firestore`);
    }
    if (Array.isArray(data?.default_excluded_pokemon_ids)) {
      setDefaultExcludedPokemonIDs(data.default_excluded_pokemon_ids as number[]);
      console.log(`Loaded ${(data.default_excluded_pokemon_ids as number[]).length} default excluded Pokemon IDs from Firestore`);
    }
  }

  pokemonFetcher = new PokeAPIService();
  aiScorer = new GeminiService(vertexAI);
  userPokemonRepo = new UserPokemonRepo(firestoreClient);
  userSettingsRepo = new UserSettingsRepo(firestoreClient);
  authMiddleware = firebaseAuth(authClient, allowedEmails);
}

// Wire up dependencies
const questService = new QuestService(pokemonFetcher, aiScorer, userSettingsRepo);
const collectionService = new CollectionService(userPokemonRepo, pokemonFetcher);

const questHandler = new QuestHandler(questService, userPokemonRepo, aiScorer);
const collectionHandler = new CollectionHandler(collectionService, userSettingsRepo);
const settingsHandler = new SettingsHandler(userSettingsRepo);

// Setup Express
const app = express();
app.use(express.json());
app.use(corsConfig(cfg.frontendURL));

const apiRouter = setupRoutes(authMiddleware, questHandler, collectionHandler, settingsHandler);
app.use("/api", apiRouter);

app.listen(parseInt(cfg.port), () => {
  console.log(`Starting server on :${cfg.port}`);
});
