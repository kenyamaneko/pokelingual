import { describe, it, expect, beforeEach } from "vitest";
import { UserRepo } from "./user-repo.js";
import { requireFirestoreEmulator, clearFirestoreEmulator } from "./firestore-emulator-helper.js";

const db = requireFirestoreEmulator();

describe("[チュートリアル] 完了状態の記録", () => {
  beforeEach(clearFirestoreEmulator);

  describe("チュートリアル完了状態を取得する", () => {
    describe("正常系", () => {
      it.each([
        ["どのユーザーも完了を一度も記録していない", []],
        ["別のユーザーだけが完了を記録している", ["bob"]],
      ])("%sとき、未完了になる", async (_label, usersWithCompletion) => {
        const repo = new UserRepo(db);
        for (const userId of usersWithCompletion) {
          await repo.markTutorialCompleted(userId);
        }

        const user = await repo.getUser("alice");
        expect(user.tutorial_completed).toBe(false);
      });

      it("チュートリアルの完了を記録したとき、完了済みになる", async () => {
        const repo = new UserRepo(db);
        await repo.markTutorialCompleted("alice");

        const user = await repo.getUser("alice");
        expect(user.tutorial_completed).toBe(true);
      });
    });
  });
});
