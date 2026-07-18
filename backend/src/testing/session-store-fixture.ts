import type { QuestSessionStore } from "../domain/ports.js";
import type { QuestSession } from "../domain/quest.js";

/**
 * インメモリの QuestSessionStore スタブを作る。
 * @param o.error 指定すると get/set/delete がこのエラーを投げる (ストア障害の模擬)。
 * @returns userId をキーにセッションを保持する QuestSessionStore。
 */
export function makeInMemoryQuestSessionStore(o: { error?: Error } = {}): QuestSessionStore {
  const sessions = new Map<string, QuestSession>();
  return {
    async get(userId) {
      if (o.error) throw o.error;
      return sessions.get(userId) ?? null;
    },
    async set(userId, session) {
      if (o.error) throw o.error;
      sessions.set(userId, session);
    },
    async delete(userId) {
      if (o.error) throw o.error;
      sessions.delete(userId);
    },
  };
}
