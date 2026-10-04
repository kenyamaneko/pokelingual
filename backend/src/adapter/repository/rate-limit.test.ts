import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { RateLimitRepo } from "./rate-limit-repo.js";
import { requireFirestoreEmulator, clearFirestoreEmulator } from "./firestore-emulator-helper.js";

const db = requireFirestoreEmulator();

describe("[レート制限・利用回数] AI 利用回数の記録と取得", () => {
  beforeEach(clearFirestoreEmulator);

  describe("正常系", () => {
    it("ユーザーの利用上限が設定されているとき、上限の回数まで続けて記録すると、記録のたびに今日の利用回数が 1 ずつ増える", async () => {
      const repo = new RateLimitRepo(db, 5, 1000);
      for (let i = 0; i < 5; i++) {
        const usage = await repo.checkAndIncrement("alice");
        expect(usage.count).toBe(i + 1);
      }
    });

    it("ユーザーの利用上限が設定されているとき、上限の回数まで続けて記録すると、記録のたびに得られる利用上限が設定した値になる", async () => {
      const repo = new RateLimitRepo(db, 5, 1000);
      for (let i = 0; i < 5; i++) {
        const usage = await repo.checkAndIncrement("alice");
        expect(usage.limit).toBe(5);
      }
    });

    it("あるユーザーがユーザーの利用上限に達しているとき、別のユーザーが記録すると、別のユーザーの今日の利用回数が 1 になる", async () => {
      const repo = new RateLimitRepo(db, 2, 1000);
      await repo.checkAndIncrement("alice");
      await repo.checkAndIncrement("alice");
      await expect(repo.checkAndIncrement("alice")).rejects.toMatchObject({
        name: "RateLimitError",
        kind: "user",
      });

      const usage = await repo.checkAndIncrement("bob");
      expect(usage.count).toBe(1);
    });

    it("今日まだ記録の無いユーザーの利用回数を取得すると、今日の利用回数が 0 になる", async () => {
      const repo = new RateLimitRepo(db, 30, 1000);
      const usage = await repo.getUserUsage("newcomer");
      expect(usage.count).toBe(0);
    });

    it("今日まだ記録の無いユーザーの利用回数を取得すると、得られる利用上限が設定した値になる", async () => {
      const repo = new RateLimitRepo(db, 30, 1000);
      const usage = await repo.getUserUsage("newcomer");
      expect(usage.limit).toBe(30);
    });

    it("同じユーザーが 3 回記録した後に利用回数を取得すると、今日の利用回数が 3 になる", async () => {
      const repo = new RateLimitRepo(db, 30, 1000);
      await repo.checkAndIncrement("alice");
      await repo.checkAndIncrement("alice");
      await repo.checkAndIncrement("alice");
      const usage = await repo.getUserUsage("alice");
      expect(usage.count).toBe(3);
    });
  });

  describe("異常系", () => {
    it("ユーザーの利用上限に達しているとき、同じユーザーが記録すると、ユーザーの利用上限に達したことを示すエラーになる", async () => {
      const repo = new RateLimitRepo(db, 2, 1000);
      await repo.checkAndIncrement("alice");
      await repo.checkAndIncrement("alice");
      await expect(repo.checkAndIncrement("alice")).rejects.toMatchObject({
        name: "RateLimitError",
        kind: "user",
      });
    });

    it("全体の利用上限に達しているとき、まだ記録していないユーザーが記録すると、全体の利用上限に達したことを示すエラーになる", async () => {
      const repo = new RateLimitRepo(db, 100, 2);
      await repo.checkAndIncrement("alice");
      await repo.checkAndIncrement("bob");
      await expect(repo.checkAndIncrement("carol")).rejects.toMatchObject({
        name: "RateLimitError",
        kind: "global",
      });
    });

    it("ユーザーの利用上限に余裕があり全体の利用上限に達しているとき、同じユーザーが記録すると、全体の利用上限に達したことを示すエラーになる", async () => {
      const repo = new RateLimitRepo(db, 100, 1);
      await repo.checkAndIncrement("alice");
      await expect(repo.checkAndIncrement("alice")).rejects.toMatchObject({ kind: "global" });
    });
  });
});

describe("[レート制限・利用回数] レート制限の日次リセット", () => {
  beforeEach(async () => {
    // Firestore SDK の内部タイマー (gRPC keepalive 等) が止まる可能性があるため、Date のみフェイクする。
    vi.useFakeTimers({ toFake: ["Date"] });
    await clearFirestoreEmulator();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("正常系", () => {
    describe("JST の日付が変わった後に記録する", () => {
      it.each([
        [
          "JST の前日にユーザーの利用上限まで記録していたとき",
          2,
          "2026-05-28T12:00:00+09:00",
          "2026-05-29T12:00:00+09:00",
        ],
        [
          "JST 23:59 にユーザーの利用上限まで記録していて、JST 0:00 ちょうどになったとき",
          1,
          "2026-05-28T23:59:00+09:00",
          "2026-05-29T00:00:00+09:00",
        ],
      ])("%s、今日の利用回数が 1 になる", async (_label, limit, usedAt, recordedAt) => {
        const repo = new RateLimitRepo(db, limit, 100);

        vi.setSystemTime(new Date(usedAt));
        for (let i = 0; i < limit; i++) {
          await repo.checkAndIncrement("alice");
        }
        await expect(repo.checkAndIncrement("alice")).rejects.toMatchObject({
          name: "RateLimitError",
          kind: "user",
        });

        vi.setSystemTime(new Date(recordedAt));
        const usage = await repo.checkAndIncrement("alice");
        expect(usage.count).toBe(1);
      });
    });
  });

  describe("異常系", () => {
    it("JST 23:59 にユーザーの利用上限まで記録しているとき、同じ JST 23:59 にもう一度記録すると、ユーザーの利用上限に達したことを示すエラーになる", async () => {
      const repo = new RateLimitRepo(db, 1, 100);

      vi.setSystemTime(new Date("2026-05-28T23:59:00+09:00"));
      await repo.checkAndIncrement("alice");

      await expect(repo.checkAndIncrement("alice")).rejects.toMatchObject({
        name: "RateLimitError",
        kind: "user",
      });
    });
  });
});
