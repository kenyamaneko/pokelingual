import { describe, it, expect, beforeEach } from "vitest";
import { UserRepo } from "./user-repo.js";
import { requireFirestoreEmulator, clearFirestoreEmulator } from "./firestore-emulator-helper.js";

const db = requireFirestoreEmulator();

describe("UserRepo (Firestore emulator)", () => {
  beforeEach(clearFirestoreEmulator);

  it("未保存ユーザーは tutorial_completed=false として読める", async () => {
    const repo = new UserRepo(db);
    const user = await repo.getUser("newcomer");
    expect(user.tutorial_completed).toBe(false);
  });

  it("markTutorialCompleted で保存した値が getUser で取得できる", async () => {
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
