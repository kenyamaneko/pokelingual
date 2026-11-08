import { describe, expect, beforeEach, afterEach, vi } from "vitest";
import { RateLimitRepo } from "./rate-limit-repo.js";
import { requireFirestoreEmulator, clearFirestoreEmulator } from "./firestore-emulator-helper.js";
import { defineCase } from "../../test/defineCase.js";

const db = requireFirestoreEmulator();

const USER_LIMIT_5 = "ユーザーごとの日次上限が 5 回に設定されているとき";
const USER_LIMIT_REACHED = "ユーザーごとの日次上限に達しているとき";
const RECORD_USAGE = "AI 呼び出し回数を記録する";
const RECORD_5_TIMES = [RECORD_USAGE, RECORD_USAGE, RECORD_USAGE, RECORD_USAGE, RECORD_USAGE] as const;
const RECORD_3_TIMES = [RECORD_USAGE, RECORD_USAGE, RECORD_USAGE] as const;
const USER_LIMIT_ERROR = "ユーザーごとの日次上限に達したことを示すエラーになる";
const GLOBAL_LIMIT_ERROR = "全体の日次上限に達したことを示すエラーになる";
const GET_USAGE = "AI 呼び出し回数を取得する";
const NEWCOMER = "今日まだ記録の無いユーザーがいるとき";

describe("[本体:AI 呼び出し回数]AI 呼び出し回数の記録と取得", () => {
  beforeEach(clearFirestoreEmulator);

  defineCase(
    {
      種別: "インフラ結合テスト",
      正常異常: "正常系",
      観点: ["境界値"],
      steps: [
        {
          Given: USER_LIMIT_5,
          When: RECORD_5_TIMES,
          Then: "記録のたびに今日の AI 呼び出し回数が 1 から 5 まで 1 ずつ増える",
        },
      ],
    },
    async () => {
      const repo = new RateLimitRepo(db, 5, 1000);
      for (let i = 0; i < 5; i++) {
        const usage = await repo.recordDailyUsage("alice");
        expect(usage.count).toBe(i + 1);
      }
    },
  );

  defineCase(
    {
      種別: "インフラ結合テスト",
      正常異常: "正常系",
      steps: [
        { Given: USER_LIMIT_5, When: RECORD_5_TIMES, Then: "記録のたびに日次上限が 5 回になる" },
      ],
    },
    async () => {
      const repo = new RateLimitRepo(db, 5, 1000);
      for (let i = 0; i < 5; i++) {
        const usage = await repo.recordDailyUsage("alice");
        expect(usage.limit).toBe(5);
      }
    },
  );

  defineCase(
    {
      種別: "インフラ結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "あるユーザーがユーザーごとの日次上限に達しているとき",
          When: ["別のユーザーの AI 呼び出し回数を記録する"],
          Then: "別のユーザーの今日の AI 呼び出し回数が 1 になる",
        },
      ],
    },
    async () => {
      const repo = new RateLimitRepo(db, 2, 1000);
      await repo.recordDailyUsage("alice");
      await repo.recordDailyUsage("alice");
      await expect(repo.recordDailyUsage("alice")).rejects.toMatchObject({
        name: "RateLimitError",
        kind: "user",
      });

      const usage = await repo.recordDailyUsage("bob");
      expect(usage.count).toBe(1);
    },
  );

  defineCase(
    {
      種別: "インフラ結合テスト",
      正常異常: "正常系",
      観点: ["件数・有無"],
      steps: [{ Given: NEWCOMER, When: [GET_USAGE], Then: "今日の AI 呼び出し回数が 0 になる" }],
    },
    async () => {
      const repo = new RateLimitRepo(db, 30, 1000);
      const usage = await repo.getUserUsage("newcomer");
      expect(usage.count).toBe(0);
    },
  );

  defineCase(
    {
      種別: "インフラ結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: `ユーザーごとの日次上限が 30 回に設定されていて、${NEWCOMER}`,
          When: [GET_USAGE],
          Then: "日次上限が 30 回になる",
        },
      ],
    },
    async () => {
      const repo = new RateLimitRepo(db, 30, 1000);
      const usage = await repo.getUserUsage("newcomer");
      expect(usage.limit).toBe(30);
    },
  );

  defineCase(
    {
      種別: "インフラ結合テスト",
      正常異常: "正常系",
      steps: [
        {
          When: [...RECORD_3_TIMES, GET_USAGE],
          Then: "今日の AI 呼び出し回数が 3 になる",
        },
      ],
    },
    async () => {
      const repo = new RateLimitRepo(db, 30, 1000);
      await repo.recordDailyUsage("alice");
      await repo.recordDailyUsage("alice");
      await repo.recordDailyUsage("alice");
      const usage = await repo.getUserUsage("alice");
      expect(usage.count).toBe(3);
    },
  );

  defineCase(
    {
      種別: "インフラ結合テスト",
      正常異常: "異常系",
      観点: ["境界値"],
      steps: [{ Given: USER_LIMIT_REACHED, When: [RECORD_USAGE], Then: USER_LIMIT_ERROR }],
    },
    async () => {
      const repo = new RateLimitRepo(db, 2, 1000);
      await repo.recordDailyUsage("alice");
      await repo.recordDailyUsage("alice");
      await expect(repo.recordDailyUsage("alice")).rejects.toMatchObject({
        name: "RateLimitError",
        kind: "user",
      });
    },
  );

  defineCase(
    {
      種別: "インフラ結合テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: "全体の日次上限に達していて、まだ記録していないユーザーがいるとき",
          When: ["そのユーザーの AI 呼び出し回数を記録する"],
          Then: GLOBAL_LIMIT_ERROR,
        },
      ],
    },
    async () => {
      const repo = new RateLimitRepo(db, 100, 2);
      await repo.recordDailyUsage("alice");
      await repo.recordDailyUsage("bob");
      await expect(repo.recordDailyUsage("carol")).rejects.toMatchObject({
        name: "RateLimitError",
        kind: "global",
      });
    },
  );

  defineCase(
    {
      種別: "インフラ結合テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: "ユーザーごとの日次上限に余裕があり全体の日次上限に達しているとき",
          When: [RECORD_USAGE],
          Then: GLOBAL_LIMIT_ERROR,
        },
      ],
    },
    async () => {
      const repo = new RateLimitRepo(db, 100, 1);
      await repo.recordDailyUsage("alice");
      await expect(repo.recordDailyUsage("alice")).rejects.toMatchObject({ kind: "global" });
    },
  );
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

  for (const { given, userLimit, globalLimit, reachedKind } of [
    {
      given: "JST 2026-05-28 23:59 にユーザーごとの日次上限まで記録が済んでいて、現在時刻が JST 2026-05-29 00:00 ちょうどのとき",
      userLimit: 1,
      globalLimit: 100,
      reachedKind: "user",
    },
    {
      given: "JST 2026-05-28 23:59 に全体の日次上限まで記録が済んでいて、現在時刻が JST 2026-05-29 00:00 ちょうどのとき",
      userLimit: 100,
      globalLimit: 1,
      reachedKind: "global",
    },
  ]) {
    defineCase(
      {
        種別: "インフラ結合テスト",
        正常異常: "正常系",
        観点: ["境界値"],
        steps: [{ Given: given, When: [RECORD_USAGE], Then: "今日の AI 呼び出し回数が 1 になる" }],
      },
      async () => {
        const repo = new RateLimitRepo(db, userLimit, globalLimit);

        vi.setSystemTime(new Date("2026-05-28T23:59:00+09:00"));
        await repo.recordDailyUsage("alice");
        await expect(repo.recordDailyUsage("alice")).rejects.toMatchObject({
          name: "RateLimitError",
          kind: reachedKind,
        });

        vi.setSystemTime(new Date("2026-05-29T00:00:00+09:00"));
        const usage = await repo.recordDailyUsage("alice");
        expect(usage.count).toBe(1);
      },
    );
  }

  defineCase(
    {
      種別: "インフラ結合テスト",
      正常異常: "異常系",
      観点: ["境界値"],
      steps: [
        {
          Given: "JST 2026-05-28 23:59 にユーザーごとの日次上限まで記録が済んでいて、現在時刻が JST 2026-05-28 23:59 のとき",
          When: [RECORD_USAGE],
          Then: USER_LIMIT_ERROR,
        },
      ],
    },
    async () => {
      const repo = new RateLimitRepo(db, 1, 100);

      vi.setSystemTime(new Date("2026-05-28T23:59:00+09:00"));
      await repo.recordDailyUsage("alice");

      await expect(repo.recordDailyUsage("alice")).rejects.toMatchObject({
        name: "RateLimitError",
        kind: "user",
      });
    },
  );
});
