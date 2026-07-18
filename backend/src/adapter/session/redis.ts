import type { Redis } from "ioredis";
import type { QuestSessionStore } from "../../domain/ports.js";
import type { QuestSession } from "../../domain/quest.js";

/** Redis プロトコルでクエストセッションを保存する QuestSessionStore 実装。 */
export class RedisQuestSessionStore implements QuestSessionStore {
  /**
   * @param redis Redis クライアント。
   * @param keyPrefix キーの名前空間 (本番クエストとチュートリアルの衝突回避)。
   * @param ttlSeconds セッションの有効期限。set のたびに再適用する。
   */
  constructor(
    private redis: Redis,
    private keyPrefix: string,
    private ttlSeconds: number,
  ) {}

  async get(userId: string): Promise<QuestSession | null> {
    const raw = await this.redis.get(this.key(userId));
    return raw === null ? null : (JSON.parse(raw) as QuestSession);
  }

  async set(userId: string, session: QuestSession): Promise<void> {
    await this.redis.set(this.key(userId), JSON.stringify(session), "EX", this.ttlSeconds);
  }

  async delete(userId: string): Promise<void> {
    await this.redis.del(this.key(userId));
  }

  private key(userId: string): string {
    return `${this.keyPrefix}${userId}`;
  }
}
