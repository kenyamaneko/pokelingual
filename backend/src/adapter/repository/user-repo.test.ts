import { describe, it, expect, beforeEach } from "vitest";
import { UserRepo } from "./user-repo.js";
import { requireFirestoreEmulator, clearFirestoreEmulator } from "./firestore-emulator-helper.js";

const db = requireFirestoreEmulator();

describe("チュートリアル完了フラグの永続化", () => {
  beforeEach(clearFirestoreEmulator);

  it("一度も保存していないユーザーの完了フラグを取得すると、未完了が返る", async () => {
    const repo = new UserRepo(db);
    const user = await repo.getUser("newcomer");
    expect(user.tutorial_completed).toBe(false);
  });

  it("完了を保存した後に取得すると、完了済みが返る", async () => {
    const repo = new UserRepo(db);
    await repo.markTutorialCompleted("alice");

    const user = await repo.getUser("alice");
    expect(user.tutorial_completed).toBe(true);
  });

  it("あるユーザーの完了は別ユーザーの状態に影響しない", async () => {
    const repo = new UserRepo(db);
    await repo.markTutorialCompleted("alice");

    const bob = await repo.getUser("bob");
    expect(bob.tutorial_completed).toBe(false);
  });
});
