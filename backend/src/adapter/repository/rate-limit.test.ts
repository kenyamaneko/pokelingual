import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { RateLimitRepo } from "./rate-limit-repo.js";
import { requireFirestoreEmulator, clearFirestoreEmulator } from "./firestore-emulator-helper.js";

const db = requireFirestoreEmulator();

describe("[本体:AI 呼び出し回数]AI 呼び出し回数の記録と取得", () => {
  beforeEach(clearFirestoreEmulator);

  describe("インフラ結合テスト", () => {
    describe("正常系", () => {
      it("ユーザーの日次上限が 5 回に設定されているとき、5 回続けて記録すると、記録のたびに今日の AI 呼び出し回数が 1 から 5 まで 1 ずつ増える", async () => {
        const repo = new RateLimitRepo(db, 5, 1000);
        for (let i = 0; i < 5; i++) {
          const usage = await repo.checkAndIncrement("alice");
          expect(usage.count).toBe(i + 1);
        }
      });

      it("ユーザーの日次上限が 5 回に設定されているとき、5 回続けて記録すると、記録のたびに得られる日次上限が 5 回になる", async () => {
        const repo = new RateLimitRepo(db, 5, 1000);
        for (let i = 0; i < 5; i++) {
          const usage = await repo.checkAndIncrement("alice");
          expect(usage.limit).toBe(5);
        }
      });

      it("あるユーザーがユーザーの日次上限に達しているとき、別のユーザーが記録すると、別のユーザーの今日の AI 呼び出し回数が 1 になる", async () => {
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

      it("今日まだ記録の無いユーザーがいるとき、そのユーザーの AI 呼び出し回数を取得すると、今日の AI 呼び出し回数が 0 になる", async () => {
        const repo = new RateLimitRepo(db, 30, 1000);
        const usage = await repo.getUserUsage("newcomer");
        expect(usage.count).toBe(0);
      });

      it("ユーザーの日次上限が 30 回に設定されていて、今日まだ記録の無いユーザーがいるとき、そのユーザーの AI 呼び出し回数を取得すると、得られる日次上限が 30 回になる", async () => {
        const repo = new RateLimitRepo(db, 30, 1000);
        const usage = await repo.getUserUsage("newcomer");
        expect(usage.limit).toBe(30);
      });

      it("同じユーザーが 3 回記録したとき、AI 呼び出し回数を取得すると、今日の AI 呼び出し回数が 3 になる", async () => {
        const repo = new RateLimitRepo(db, 30, 1000);
        await repo.checkAndIncrement("alice");
        await repo.checkAndIncrement("alice");
        await repo.checkAndIncrement("alice");
        const usage = await repo.getUserUsage("alice");
        expect(usage.count).toBe(3);
      });
    });

    describe("異常系", () => {
      it("ユーザーの日次上限に達しているとき、同じユーザーが記録すると、ユーザーの日次上限に達したことを示すエラーになる", async () => {
        const repo = new RateLimitRepo(db, 2, 1000);
        await repo.checkAndIncrement("alice");
        await repo.checkAndIncrement("alice");
        await expect(repo.checkAndIncrement("alice")).rejects.toMatchObject({
          name: "RateLimitError",
          kind: "user",
        });
      });

      it("全体の日次上限に達しているとき、まだ記録していないユーザーが記録すると、全体の日次上限に達したことを示すエラーになる", async () => {
        const repo = new RateLimitRepo(db, 100, 2);
        await repo.checkAndIncrement("alice");
        await repo.checkAndIncrement("bob");
        await expect(repo.checkAndIncrement("carol")).rejects.toMatchObject({
          name: "RateLimitError",
          kind: "global",
        });
      });

      it("ユーザーの日次上限に余裕があり全体の日次上限に達しているとき、同じユーザーが記録すると、全体の日次上限に達したことを示すエラーになる", async () => {
        const repo = new RateLimitRepo(db, 100, 1);
        await repo.checkAndIncrement("alice");
        await expect(repo.checkAndIncrement("alice")).rejects.toMatchObject({ kind: "global" });
      });
    });
  });
});

describe("[本体:AI 呼び出し回数]日次上限のリセット", () => {
  beforeEach(async () => {
    // Firestore SDK の内部タイマー (gRPC keepalive 等) が止まる可能性があるため、Date のみフェイクする。
    vi.useFakeTimers({ toFake: ["Date"] });
    await clearFirestoreEmulator();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("記録すると", () => {
    describe("インフラ結合テスト", () => {
      describe("正常系", () => {
        it.each([
          [
            "JST 2026-05-28 23:59 にユーザーの日次上限まで記録していて、JST 2026-05-29 00:00 ちょうどになった",
            1,
            100,
            "user",
          ],
          [
            "JST 2026-05-28 23:59 に全体の日次上限まで記録していて、JST 2026-05-29 00:00 ちょうどになった",
            100,
            1,
            "global",
          ],
        ])("%sとき、今日の AI 呼び出し回数が 1 になる", async (_situation, userLimit, globalLimit, reachedKind) => {
          const repo = new RateLimitRepo(db, userLimit, globalLimit);

          vi.setSystemTime(new Date("2026-05-28T23:59:00+09:00"));
          await repo.checkAndIncrement("alice");
          await expect(repo.checkAndIncrement("alice")).rejects.toMatchObject({
            name: "RateLimitError",
            kind: reachedKind,
          });

          vi.setSystemTime(new Date("2026-05-29T00:00:00+09:00"));
          const usage = await repo.checkAndIncrement("alice");
          expect(usage.count).toBe(1);
        });
      });

      describe("異常系", () => {
        it("JST 2026-05-28 23:59 にユーザーの日次上限まで記録しているとき、同じ JST 23:59 にもう一度記録すると、ユーザーの日次上限に達したことを示すエラーになる", async () => {
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
  });
});
