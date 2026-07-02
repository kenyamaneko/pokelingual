import { Router } from "express";
import type { RequestHandler } from "express";
import type { QuestHandler } from "../handler/quest-handler.js";
import type { CollectionHandler } from "../handler/collection-handler.js";
import type { SettingsHandler } from "../handler/settings-handler.js";
import type { UsageHandler } from "../handler/usage-handler.js";

/**
 * 認証ミドルウェアを噛ませた API ルータを構築して返す。
 * @param authMiddleware 認証ミドルウェア。
 * @param rateLimitMiddleware レート制限ミドルウェア。
 * @param questHandler クエスト系ハンドラ。
 * @param collectionHandler 図鑑系ハンドラ。
 * @param settingsHandler 設定系ハンドラ。
 * @param usageHandler 利用状況ハンドラ。
 * @returns 構築済みの Express ルータ。
 */
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
  router.post("/quest/skip-guess", questHandler.skipGuess);
  router.post("/quest/capture", questHandler.attemptCapture);
  router.post("/quest/chat", rateLimitMiddleware, questHandler.replyToChat);

  router.get("/collection", collectionHandler.getCollection);
  router.get("/collection/:id", collectionHandler.getPokemonDetail);

  router.get("/settings", settingsHandler.getSettings);
  router.put("/settings/excluded-pokemon", settingsHandler.updateExcludedPokemon);

  router.get("/usage", usageHandler.getUsage);

  return router;
}
