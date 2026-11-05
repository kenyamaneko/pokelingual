import { describe, it, expect, beforeEach } from "vitest";
import { UserRepo } from "./user-repo.js";
import { requireFirestoreEmulator, clearFirestoreEmulator } from "./firestore-emulator-helper.js";

const db = requireFirestoreEmulator();

describe("[本体:チュートリアル]完了状態の記録", () => {
  beforeEach(clearFirestoreEmulator);

  describe("あるユーザーのチュートリアル完了状態を取得すると", () => {
    describe("インフラ結合テスト", () => {
      describe("正常系", () => {
        it.each([
          ["どのユーザーもチュートリアルの完了を一度も記録していない", []],
          ["別のユーザーだけがチュートリアルの完了を記録している", ["bob"]],
        ])("%sとき、チュートリアル完了状態は未完了になる", async (_situation, usersWithCompletion) => {
          const repo = new UserRepo(db);
          for (const userId of usersWithCompletion) {
            await repo.markTutorialCompleted(userId);
          }

          const user = await repo.getUser("alice");
          expect(user.tutorial_completed).toBe(false);
        });

        it("チュートリアルの完了を記録したとき、チュートリアル完了状態は完了済みになる", async () => {
          const repo = new UserRepo(db);
          await repo.markTutorialCompleted("alice");

          const user = await repo.getUser("alice");
          expect(user.tutorial_completed).toBe(true);
        });

        it("チュートリアルの完了を記録した後に未完了へ戻したとき、チュートリアル完了状態は未完了になる", async () => {
          const repo = new UserRepo(db);
          await repo.markTutorialCompleted("alice");
          await repo.resetTutorialCompleted("alice");

          const user = await repo.getUser("alice");
          expect(user.tutorial_completed).toBe(false);
        });
      });
    });
  });
});
