import { Router } from "express";
import type { RequestHandler } from "express";
import type { QuestHandler } from "../handler/quest-handler.js";
import type { CollectionHandler } from "../handler/collection-handler.js";
import type { SettingsHandler } from "../handler/settings-handler.js";
import type { UsageHandler } from "../handler/usage-handler.js";

export function setupRoutes(
  authMiddleware: RequestHandler,
  rateLimitMiddleware: RequestHandler,
  questHandler: QuestHandler,
  collectionHandler: CollectionHandler,
  settingsHandler: SettingsHandler,
  usageHandler: UsageHandler,
): Router {
  const router = Router();
  router.use(authMiddleware);

  // Quest routes — Gemini を呼ぶ score/chat のみレートリミット対象
  router.get("/quest/new", questHandler.newQuest);
  router.post("/quest/score", rateLimitMiddleware, questHandler.scoreTranslation);
  router.post("/quest/guess-name", questHandler.guessName);
  router.post("/quest/capture", questHandler.attemptCapture);
  router.post("/quest/chat", rateLimitMiddleware, questHandler.chat);

  // Collection routes
  router.get("/collection", collectionHandler.getCollection);
  router.get("/collection/:id", collectionHandler.getPokemonDetail);

  // Settings routes
  router.get("/settings", settingsHandler.getSettings);
  router.put("/settings/excluded-pokemon", settingsHandler.updateExcludedPokemon);

  // Usage
  router.get("/usage", usageHandler.getUsage);

  return router;
}
