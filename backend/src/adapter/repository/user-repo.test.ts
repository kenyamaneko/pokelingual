import { describe, expect, beforeEach } from "vitest";
import { UserRepo } from "./user-repo.js";
import { requireFirestoreEmulator, clearFirestoreEmulator } from "./firestore-emulator-helper.js";
import { defineCase } from "../../test/defineCase.js";

const db = requireFirestoreEmulator();

const GET_TUTORIAL_STATUS = "あるユーザーのチュートリアル完了状態を取得する";

describe("[本体:チュートリアル]チュートリアル完了状態の取得と記録", () => {
  beforeEach(clearFirestoreEmulator);

  for (const { given, usersWithCompletion } of [
    { given: "どのユーザーもチュートリアルの完了を一度も記録していないとき", usersWithCompletion: [] },
    { given: "別のユーザーだけがチュートリアルの完了を記録しているとき", usersWithCompletion: ["bob"] },
  ]) {
    defineCase(
      {
        種別: "インフラ結合テスト",
        正常異常: "正常系",
        steps: [
          {
            Given: given,
            When: [GET_TUTORIAL_STATUS],
            Then: "チュートリアル完了状態は未完了になる",
          },
        ],
      },
      async () => {
        const repo = new UserRepo(db);
        for (const userId of usersWithCompletion) {
          await repo.markTutorialCompleted(userId);
        }

        const user = await repo.getUser("alice");
        expect(user.tutorial_completed).toBe(false);
      },
    );
  }

  defineCase(
    {
      種別: "インフラ結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "チュートリアルの完了を記録したとき",
          When: [GET_TUTORIAL_STATUS],
          Then: "チュートリアル完了状態は完了済みになる",
        },
      ],
    },
    async () => {
      const repo = new UserRepo(db);
      await repo.markTutorialCompleted("alice");

      const user = await repo.getUser("alice");
      expect(user.tutorial_completed).toBe(true);
    },
  );

  defineCase(
    {
      種別: "インフラ結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "チュートリアルの完了を記録した後に未完了へ戻したとき",
          When: [GET_TUTORIAL_STATUS],
          Then: "チュートリアル完了状態は未完了になる",
        },
      ],
    },
    async () => {
      const repo = new UserRepo(db);
      await repo.markTutorialCompleted("alice");
      await repo.resetTutorialCompleted("alice");

      const user = await repo.getUser("alice");
      expect(user.tutorial_completed).toBe(false);
    },
  );
});
