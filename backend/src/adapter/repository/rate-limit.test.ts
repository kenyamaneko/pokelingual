import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { RateLimitRepo } from "./rate-limit-repo.js";
import { requireFirestoreEmulator, clearFirestoreEmulator } from "./firestore-emulator-helper.js";
import { RateLimitError } from "../../domain/errors.js";

const db = requireFirestoreEmulator();

describe("AI 利用回数の記録", () => {
  beforeEach(clearFirestoreEmulator);

  it("ユーザーは 5 回まで AI 呼び出しできる", async () => {
    const repo = new RateLimitRepo(db, 5, 1000);
    for (let i = 0; i < 5; i++) {
      const usage = await repo.checkAndIncrement("alice");
      expect(usage.count).toBe(i + 1);
      expect(usage.limit).toBe(5);
    }
  });

  it("ユーザーが上限を超えると、ユーザー上限のエラーになる", async () => {
    const repo = new RateLimitRepo(db, 2, 1000);
    await repo.checkAndIncrement("alice");
    await repo.checkAndIncrement("alice");
    await expect(repo.checkAndIncrement("alice")).rejects.toMatchObject({
      name: "RateLimitError",
      kind: "user",
    });
  });

  it("あるユーザーが利用枠を消化しても、別ユーザーには影響しない", async () => {
    const repo = new RateLimitRepo(db, 2, 1000);
    await repo.checkAndIncrement("alice");
    await repo.checkAndIncrement("alice");
    await expect(repo.checkAndIncrement("alice")).rejects.toThrow(RateLimitError);

    const usage = await repo.checkAndIncrement("bob");
    expect(usage.count).toBe(1);
  });

  it("全体の利用回数が全体の上限を超えると、全体上限のエラーになる", async () => {
    const repo = new RateLimitRepo(db, 100, 2);
    await repo.checkAndIncrement("alice");
    await repo.checkAndIncrement("bob");
    await expect(repo.checkAndIncrement("carol")).rejects.toMatchObject({
      name: "RateLimitError",
      kind: "global",
    });
  });

  it("全体上限はユーザー上限より優先して判定される", async () => {
    const repo = new RateLimitRepo(db, 100, 1);
    await repo.checkAndIncrement("alice");
    // alice はまだ余裕あるが、グローバルが先に詰まっているので global エラー
    await expect(repo.checkAndIncrement("alice")).rejects.toMatchObject({ kind: "global" });
  });

  it("未使用のユーザーの利用回数を取得すると、0 が返る", async () => {
    const repo = new RateLimitRepo(db, 30, 1000);
    const usage = await repo.getUserUsage("newcomer");
    expect(usage.count).toBe(0);
    expect(usage.limit).toBe(30);
  });

  it("AI 呼び出しを 3 回記録した後に利用回数を取得すると、記録した回数と一致する", async () => {
    const repo = new RateLimitRepo(db, 30, 1000);
    await repo.checkAndIncrement("alice");
    await repo.checkAndIncrement("alice");
    await repo.checkAndIncrement("alice");
    const usage = await repo.getUserUsage("alice");
    expect(usage.count).toBe(3);
  });
});

describe("レート制限の日次リセット", () => {
  // Date のみフェイクし、setTimeout 等の timer はリアルに保つ。
  // 全 timer をフェイクすると Firestore SDK の内部タイマー (gRPC keepalive 等) が止まる可能性があるため。
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    await clearFirestoreEmulator();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("JST で日付が変わると新しい枠で使えるようになる", async () => {
    const repo = new RateLimitRepo(db, 2, 100);

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

  it("リセット境界は JST 0:00 (UTC 15:00)", async () => {
    const repo = new RateLimitRepo(db, 1, 100);

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
