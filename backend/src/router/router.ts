import { Router } from "express";
import type { RequestHandler } from "express";
import type { QuestHandler } from "../handler/quest-handler.js";
import type { PokedexHandler } from "../handler/pokedex-handler.js";
import type { SettingsHandler } from "../handler/settings-handler.js";
import type { UsageHandler } from "../handler/usage-handler.js";
import type { TutorialHandler } from "../handler/tutorial-handler.js";

/**
 * 認証ミドルウェアを噛ませた API ルータを構築して返す。
 * @param authMiddleware 認証ミドルウェア。
 * @param rateLimitMiddleware レート制限ミドルウェア。
 * @param questHandler クエスト系ハンドラ。
 * @param pokedexHandler 図鑑系ハンドラ。
 * @param settingsHandler 設定系ハンドラ。
 * @param usageHandler 利用状況ハンドラ。
 * @param tutorialHandler チュートリアル完了フラグハンドラ。
 * @returns 構築済みの Express ルータ。
 */
export function setupRoutes(
  authMiddleware: RequestHandler,
  rateLimitMiddleware: RequestHandler,
  questHandler: QuestHandler,
  pokedexHandler: PokedexHandler,
  settingsHandler: SettingsHandler,
  usageHandler: UsageHandler,
  tutorialHandler: TutorialHandler,
): Router {
  const router = Router();
  router.use(authMiddleware);

  // Quest routes — Gemini を呼ぶ score のみレートリミット対象
  router.get("/quest/locations", questHandler.getLocations);
  router.get("/quest/new", questHandler.newQuest);
  router.post("/quest/score", rateLimitMiddleware, questHandler.scoreTranslation);
  router.post("/quest/guess-name", questHandler.guessName);
  router.post("/quest/skip-guess", questHandler.skipGuess);
  router.post("/quest/capture", questHandler.attemptCapture);

  router.get("/pokedex", pokedexHandler.getPokedex);
  router.get("/pokedex/:id", pokedexHandler.getPokemonDetail);

  router.get("/settings", settingsHandler.getSettings);
  router.put("/settings/excluded-pokemon", settingsHandler.updateExcludedPokemon);
  router.put("/settings/generations", settingsHandler.updateEnabledGenerations);

  router.get("/usage", usageHandler.getUsage);

  router.get("/tutorial-status", tutorialHandler.getStatus);
  router.put("/tutorial-status/complete", tutorialHandler.markCompleted);

  return router;
}
