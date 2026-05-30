import { RateLimitError } from "../apperror/apperror.js";
import type { DailyUsage, RateLimitRepository } from "../domain/interfaces.js";

/** ローカル開発用のインメモリ RateLimitRepository 実装。プロセス再起動で揮発する。 */
export class MockRateLimitRepo implements RateLimitRepository {
  private userCounts = new Map<string, { date: string; count: number }>();
  private globalCount: { date: string; count: number } = { date: "", count: 0 };

  constructor(
    private perUserLimit: number,
    private globalLimit: number,
  ) {}

  async checkAndIncrement(uid: string): Promise<DailyUsage> {
    const today = jstDate();
    const userEntry = this.getUserEntry(uid, today);

    if (this.globalCount.date !== today) {
      this.globalCount = { date: today, count: 0 };
    }

    if (this.globalCount.count >= this.globalLimit) throw new RateLimitError("global");
    if (userEntry.count >= this.perUserLimit) throw new RateLimitError("user");

    userEntry.count++;
    this.globalCount.count++;
    return { count: userEntry.count, limit: this.perUserLimit };
  }

  async getUserUsage(uid: string): Promise<DailyUsage> {
    const userEntry = this.getUserEntry(uid, jstDate());
    return { count: userEntry.count, limit: this.perUserLimit };
  }

  private getUserEntry(uid: string, today: string): { date: string; count: number } {
    const existing = this.userCounts.get(uid);
    if (!existing || existing.date !== today) {
      const fresh = { date: today, count: 0 };
      this.userCounts.set(uid, fresh);
      return fresh;
    }
    return existing;
  }
}

function jstDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}
