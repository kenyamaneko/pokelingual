import { QuestService } from "../service/quest-service.js";
import { QuestHandler } from "../handler/quest-handler.js";
import { TutorialPokemonClient } from "../adapter/pokemon/tutorial.js";
import { TutorialLLMClient } from "../adapter/llm/tutorial.js";
import { MockRandomSource } from "../adapter/random/mock.js";
import { NoopUserPokemonRepo } from "../adapter/repository/noop-user-pokemon-repo.js";
import { FixedUserSettingsRepo } from "../adapter/repository/fixed-user-settings-repo.js";
import type { AppEnvironment } from "../domain/environment.js";
import type { QuestSessionStore } from "../domain/ports.js";

/**
 * 本番のクエストパイプラインを、チュートリアル専用アダプタで組み立てる。
 * @param environment 実行環境。
 * @param sessionStore チュートリアル用のクエストセッションストア。本番クエストとは別名前空間で保存する。
 * @returns チュートリアル用のクエストハンドラ。
 */
export function createTutorialQuestHandler(environment: AppEnvironment, sessionStore: QuestSessionStore): QuestHandler {
  const questService = new QuestService(
    new TutorialPokemonClient(),
    new TutorialLLMClient(),
    environment,
    new FixedUserSettingsRepo(),
    new MockRandomSource(),
    sessionStore,
  );
  return new QuestHandler(questService, new NoopUserPokemonRepo());
}
