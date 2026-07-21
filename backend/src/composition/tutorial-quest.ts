import { QuestService } from "../service/quest-service.js";
import type { QuestTuningConfig } from "../service/quest-service.js";
import { QuestHandler } from "../handler/quest-handler.js";
import { TutorialPokemonClient } from "../adapter/pokemon/tutorial.js";
import { TutorialLLMClient } from "../adapter/llm/tutorial.js";
import { MockRandomSource } from "../adapter/random/mock.js";
import { NoopUserPokemonRepo } from "../adapter/repository/noop-user-pokemon-repo.js";
import { FixedUserSettingsRepo } from "../adapter/repository/fixed-user-settings-repo.js";
import type { QuestSessionStore } from "../domain/ports.js";

/**
 * 本番のクエストパイプラインを、チュートリアル専用アダプタで組み立てる。
 * @param sessionStore チュートリアル用のクエストセッションストア。本番クエストとは別名前空間で保存する。
 * @param tuning チューニングパラメーター。本番と同じ判定ロジックを再利用するため本番と同じ値を渡す。
 * @returns チュートリアル用のクエストハンドラ。
 */
export function createTutorialQuestHandler(
  sessionStore: QuestSessionStore,
  tuning: QuestTuningConfig,
): QuestHandler {
  const questService = new QuestService(
    new TutorialPokemonClient(),
    new TutorialLLMClient(),
    new FixedUserSettingsRepo(),
    new MockRandomSource(),
    sessionStore,
    tuning,
  );
  return new QuestHandler(questService, new NoopUserPokemonRepo());
}
