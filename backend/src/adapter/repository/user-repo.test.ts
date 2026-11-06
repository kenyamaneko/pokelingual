import { describe, expect, beforeEach } from "vitest";
import { UserRepo } from "./user-repo.js";
import { requireFirestoreEmulator, clearFirestoreEmulator } from "./firestore-emulator-helper.js";
import { defineCase, type Viewpoint } from "../../test/defineCase.js";

const db = requireFirestoreEmulator();

const GET_TUTORIAL_STATUS =
  "ホーム画面の「ポケモンを探しに行く」の遷移先を決めるために、あるユーザーのチュートリアル完了状態を取得する";

describe("[本体:チュートリアル]チュートリアル完了状態の取得と記録", () => {
  beforeEach(clearFirestoreEmulator);

  const incompleteTutorialRows: { given: string; usersWithCompletion: string[]; viewpoints: readonly Viewpoint[] }[] = [
    { given: "どのユーザーもチュートリアルの完了を一度も記録していないとき", usersWithCompletion: [], viewpoints: ["件数・有無"] },
    { given: "別のユーザーだけがチュートリアルの完了を記録しているとき", usersWithCompletion: ["bob"], viewpoints: [] },
  ];
  for (const { given, usersWithCompletion, viewpoints } of incompleteTutorialRows) {
    defineCase(
      {
        種別: "インフラ結合テスト",
        正常異常: "正常系",
        観点: viewpoints,
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
          Given: "チュートリアルの完了の記録が済んでいるとき",
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
          Given: "チュートリアルの完了の記録と、未完了へ戻す操作が、この順に済んでいるとき",
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
