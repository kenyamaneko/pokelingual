import { describe, expect, beforeEach, afterEach, vi } from "vitest";
import { RateLimitRepo } from "./rate-limit-repo.js";
import { requireFirestoreEmulator, clearFirestoreEmulator } from "./firestore-emulator-helper.js";
import { defineCase } from "../../test/defineCase.js";

const db = requireFirestoreEmulator();

const USER_LIMIT_5 = "ユーザーの日次上限が 5 回に設定されているとき";
const RECORD_5_TIMES = "クエスト画面の翻訳の採点で、AI 呼び出し回数を 5 回続けて記録する";
const USER_LIMIT_REACHED = "ユーザーの日次上限に達しているとき";
const SAME_USER_RECORDS = "クエスト画面の翻訳の採点で、同じユーザーの AI 呼び出し回数を記録する";
const USER_LIMIT_ERROR = "ユーザーの日次上限に達したことを示すエラーになる";
const GLOBAL_LIMIT_ERROR = "全体の日次上限に達したことを示すエラーになる";
const GET_USAGE = "ヘッダの「今日の残り回数」を表示するために、そのユーザーの AI 呼び出し回数を取得する";
const NEWCOMER = "今日まだ記録の無いユーザーがいるとき";

describe("[本体:AI 呼び出し回数]AI 呼び出し回数の記録と取得", () => {
  beforeEach(clearFirestoreEmulator);

  defineCase(
    {
      種別: "インフラ結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: USER_LIMIT_5,
          When: [RECORD_5_TIMES],
          Then: "記録のたびに今日の AI 呼び出し回数が 1 から 5 まで 1 ずつ増える",
        },
      ],
    },
    async () => {
      const repo = new RateLimitRepo(db, 5, 1000);
      for (let i = 0; i < 5; i++) {
        const usage = await repo.checkAndIncrement("alice");
        expect(usage.count).toBe(i + 1);
      }
    },
  );

  defineCase(
    {
      種別: "インフラ結合テスト",
      正常異常: "正常系",
      steps: [
        { Given: USER_LIMIT_5, When: [RECORD_5_TIMES], Then: "記録のたびに得られる日次上限が 5 回になる" },
      ],
    },
    async () => {
      const repo = new RateLimitRepo(db, 5, 1000);
      for (let i = 0; i < 5; i++) {
        const usage = await repo.checkAndIncrement("alice");
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
          Given: "あるユーザーがユーザーの日次上限に達しているとき",
          When: ["クエスト画面の翻訳の採点で、別のユーザーの AI 呼び出し回数を記録する"],
          Then: "別のユーザーの今日の AI 呼び出し回数が 1 になる",
        },
      ],
    },
    async () => {
      const repo = new RateLimitRepo(db, 2, 1000);
      await repo.checkAndIncrement("alice");
      await repo.checkAndIncrement("alice");
      await expect(repo.checkAndIncrement("alice")).rejects.toMatchObject({
        name: "RateLimitError",
        kind: "user",
      });

      const usage = await repo.checkAndIncrement("bob");
      expect(usage.count).toBe(1);
    },
  );

  defineCase(
    {
      種別: "インフラ結合テスト",
      正常異常: "正常系",
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
          Given: `ユーザーの日次上限が 30 回に設定されていて、${NEWCOMER}`,
          When: [GET_USAGE],
          Then: "得られる日次上限が 30 回になる",
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
          When: [
            "クエスト画面の翻訳の採点で、同じユーザーの AI 呼び出し回数を 3 回記録する",
            "ヘッダの「今日の残り回数」を表示するために、同じユーザーの AI 呼び出し回数を取得する",
          ],
          Then: "今日の AI 呼び出し回数が 3 になる",
        },
      ],
    },
    async () => {
      const repo = new RateLimitRepo(db, 30, 1000);
      await repo.checkAndIncrement("alice");
      await repo.checkAndIncrement("alice");
      await repo.checkAndIncrement("alice");
      const usage = await repo.getUserUsage("alice");
      expect(usage.count).toBe(3);
    },
  );

  defineCase(
    {
      種別: "インフラ結合テスト",
      正常異常: "異常系",
      steps: [{ Given: USER_LIMIT_REACHED, When: [SAME_USER_RECORDS], Then: USER_LIMIT_ERROR }],
    },
    async () => {
      const repo = new RateLimitRepo(db, 2, 1000);
      await repo.checkAndIncrement("alice");
      await repo.checkAndIncrement("alice");
      await expect(repo.checkAndIncrement("alice")).rejects.toMatchObject({
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
          Given: "全体の日次上限に達しているとき",
          When: ["クエスト画面の翻訳の採点で、まだ記録していないユーザーの AI 呼び出し回数を記録する"],
          Then: GLOBAL_LIMIT_ERROR,
        },
      ],
    },
    async () => {
      const repo = new RateLimitRepo(db, 100, 2);
      await repo.checkAndIncrement("alice");
      await repo.checkAndIncrement("bob");
      await expect(repo.checkAndIncrement("carol")).rejects.toMatchObject({
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
          Given: "ユーザーの日次上限に余裕があり全体の日次上限に達しているとき",
          When: [SAME_USER_RECORDS],
          Then: GLOBAL_LIMIT_ERROR,
        },
      ],
    },
    async () => {
      const repo = new RateLimitRepo(db, 100, 1);
      await repo.checkAndIncrement("alice");
      await expect(repo.checkAndIncrement("alice")).rejects.toMatchObject({ kind: "global" });
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
      given: "JST 2026-05-28 23:59 にユーザーの日次上限まで記録が済んでいて、現在時刻が JST 2026-05-29 00:00 ちょうどのとき",
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
        steps: [{ Given: given, When: ["クエスト画面の翻訳の採点で、AI 呼び出し回数を記録する"], Then: "今日の AI 呼び出し回数が 1 になる" }],
      },
      async () => {
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
      },
    );
  }

  defineCase(
    {
      種別: "インフラ結合テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: "JST 2026-05-28 23:59 にユーザーの日次上限まで記録が済んでいるとき",
          When: ["クエスト画面の翻訳の採点で、同じ JST 23:59 に AI 呼び出し回数をもう一度記録する"],
          Then: USER_LIMIT_ERROR,
        },
      ],
    },
    async () => {
      const repo = new RateLimitRepo(db, 1, 100);

      vi.setSystemTime(new Date("2026-05-28T23:59:00+09:00"));
      await repo.checkAndIncrement("alice");

      await expect(repo.checkAndIncrement("alice")).rejects.toMatchObject({
        name: "RateLimitError",
        kind: "user",
      });
    },
  );
});
