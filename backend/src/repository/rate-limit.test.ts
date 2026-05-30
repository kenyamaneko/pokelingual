import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MockRateLimitRepo } from "./rate-limit-repo-mock.js";
import { RateLimitError } from "../apperror/apperror.js";
import type { RateLimitRepository } from "../domain/interfaces.js";

// レートリミット機能のふるまい仕様。実装に依存しないコントラクトテスト
function rateLimitContract(label: string, createRepo: (perUser: number, global: number) => RateLimitRepository) {
  describe(label, () => {
    it("ユーザーは perUserLimit 回までAI呼び出しできる", async () => {
      const repo = createRepo(5, 1000);
      for (let i = 0; i < 5; i++) {
        const usage = await repo.checkAndIncrement("alice");
        expect(usage.count).toBe(i + 1);
        expect(usage.limit).toBe(5);
      }
    });

    it("ユーザーが上限を超えると RateLimitError(user) になる", async () => {
      const repo = createRepo(2, 1000);
      await repo.checkAndIncrement("alice");
      await repo.checkAndIncrement("alice");
      await expect(repo.checkAndIncrement("alice")).rejects.toMatchObject({
        name: "RateLimitError",
        kind: "user",
      });
    });

    it("あるユーザーの枠消化は別ユーザーに影響しない", async () => {
      const repo = createRepo(2, 1000);
      await repo.checkAndIncrement("alice");
      await repo.checkAndIncrement("alice");
      await expect(repo.checkAndIncrement("alice")).rejects.toThrow(RateLimitError);

      const usage = await repo.checkAndIncrement("bob");
      expect(usage.count).toBe(1);
    });

    it("全体の総数が globalLimit を超えると RateLimitError(global) になる", async () => {
      const repo = createRepo(100, 2);
      await repo.checkAndIncrement("alice");
      await repo.checkAndIncrement("bob");
      await expect(repo.checkAndIncrement("carol")).rejects.toMatchObject({
        name: "RateLimitError",
        kind: "global",
      });
    });

    it("グローバル上限はユーザー上限より優先して判定される", async () => {
      const repo = createRepo(100, 1);
      await repo.checkAndIncrement("alice");
      // alice はまだ余裕あるが、グローバルが先に詰まっているので global エラー
      await expect(repo.checkAndIncrement("alice")).rejects.toMatchObject({ kind: "global" });
    });

    it("getUserUsage で未使用ユーザーの count は 0 が返る", async () => {
      const repo = createRepo(30, 1000);
      const usage = await repo.getUserUsage("newcomer");
      expect(usage.count).toBe(0);
      expect(usage.limit).toBe(30);
    });

    it("getUserUsage は increment と整合する", async () => {
      const repo = createRepo(30, 1000);
      await repo.checkAndIncrement("alice");
      await repo.checkAndIncrement("alice");
      await repo.checkAndIncrement("alice");
      const usage = await repo.getUserUsage("alice");
      expect(usage.count).toBe(3);
    });
  });
}

rateLimitContract("MockRateLimitRepo", (perUser, global) => new MockRateLimitRepo(perUser, global));

describe("レートリミットの日次リセット仕様", () => {
  // 翌日に切り替わるとカウントがリセットされることを Date モックで検証
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("JST で日付が変わると新しい枠で使えるようになる", async () => {
    const repo = new MockRateLimitRepo(2, 100);

    // JST 2026-05-28 12:00 相当 (UTC 03:00)
    vi.setSystemTime(new Date("2026-05-28T03:00:00Z"));
    await repo.checkAndIncrement("alice");
    await repo.checkAndIncrement("alice");
    await expect(repo.checkAndIncrement("alice")).rejects.toThrow(RateLimitError);

    // JST 2026-05-29 12:00 相当
    vi.setSystemTime(new Date("2026-05-29T03:00:00Z"));
    const usage = await repo.checkAndIncrement("alice");
    expect(usage.count).toBe(1);
  });

  it("リセット境界は JST 0:00（UTC 15:00）", async () => {
    const repo = new MockRateLimitRepo(1, 100);

    // JST 2026-05-28 23:59 = UTC 14:59
    vi.setSystemTime(new Date("2026-05-28T14:59:00Z"));
    await repo.checkAndIncrement("alice");
    await expect(repo.checkAndIncrement("alice")).rejects.toThrow(RateLimitError);

    // JST 2026-05-29 00:00 = UTC 15:00 でリセット
    vi.setSystemTime(new Date("2026-05-28T15:00:00Z"));
    const usage = await repo.checkAndIncrement("alice");
    expect(usage.count).toBe(1);
  });
});
