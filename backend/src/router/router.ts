import { Router } from "express";
import type { RequestHandler } from "express";
import type { QuestHandler } from "../handler/quest-handler.js";
import type { PokedexHandler } from "../handler/pokedex-handler.js";
import type { SettingsHandler } from "../handler/settings-handler.js";
import type { UsageHandler } from "../handler/usage-handler.js";
import type { TutorialHandler } from "../handler/tutorial-handler.js";

/**
 * クエスト系のルートを指定プレフィックスにまとめて登録する。
 * @param router 登録先ルータ。
 * @param prefix ルートのプレフィックス。
 * @param handler クエスト系ハンドラ。
 * @param rateLimitMiddleware 採点に噛ませるレート制限 (省略時は無制限)。
 */
function mountQuestRoutes(
  router: Router,
  prefix: string,
  handler: QuestHandler,
  rateLimitMiddleware?: RequestHandler,
): void {
  // 採点だけ LLM を呼ぶため、レート制限は採点のみに噛ませる。
  const scoreMiddleware = rateLimitMiddleware ? [rateLimitMiddleware] : [];
  router.get(`${prefix}/locations`, handler.getLocations);
  router.get(`${prefix}/new`, handler.newQuest);
  router.post(`${prefix}/score`, ...scoreMiddleware, handler.scoreTranslation);
  router.post(`${prefix}/guess-name`, handler.guessName);
  router.post(`${prefix}/skip-guess`, handler.skipGuess);
  router.post(`${prefix}/capture`, handler.attemptCapture);
}

/**
 * 認証ミドルウェアを噛ませた API ルータを構築して返す。
 * @param authMiddleware 認証ミドルウェア。
 * @param rateLimitMiddleware レート制限ミドルウェア。
 * @param questHandler 本番クエスト系ハンドラ。
 * @param tutorialQuestHandler チュートリアル用クエスト系ハンドラ。
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
  tutorialQuestHandler: QuestHandler,
  pokedexHandler: PokedexHandler,
  settingsHandler: SettingsHandler,
  usageHandler: UsageHandler,
  tutorialHandler: TutorialHandler,
): Router {
  const router = Router();
  router.use(authMiddleware);

  // チュートリアルは固定シナリオでコストが無いため、レート制限を噛ませない。
  mountQuestRoutes(router, "/quest", questHandler, rateLimitMiddleware);
  mountQuestRoutes(router, "/tutorial/quest", tutorialQuestHandler);

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
