import { describe, it, expect, beforeEach } from "vitest";
import { MockUserSettingsRepo } from "./user-settings-repo-mock.js";
import { UserSettingsRepo } from "./user-settings-repo.js";
import { requireFirestoreEmulator, clearFirestoreEmulator } from "./firestore-emulator-helper.js";
import type { UserSettingsRepository } from "../domain/interfaces.js";

// ユーザ設定の永続化仕様。実装に依存しないコントラクトテスト。
function userSettingsContract(
  label: string,
  createRepo: () => UserSettingsRepository,
  setup?: () => Promise<void>,
) {
  describe(label, () => {
    if (setup) beforeEach(setup);

    it("未保存ユーザーは excluded_pokemon_ids=null として読める", async () => {
      const repo = createRepo();
      const settings = await repo.getSettings("newcomer");
      expect(settings.excluded_pokemon_ids).toBeNull();
    });

    it("updateExcludedPokemon で保存した値が getSettings で取得できる", async () => {
      const repo = createRepo();
      await repo.updateExcludedPokemon("alice", [1, 25, 150]);

      const settings = await repo.getSettings("alice");
      expect(settings.excluded_pokemon_ids).toEqual([1, 25, 150]);
    });

    it("updateExcludedPokemon は後勝ちで上書きする", async () => {
      const repo = createRepo();
      await repo.updateExcludedPokemon("alice", [1, 25]);
      await repo.updateExcludedPokemon("alice", [4, 7]);

      const settings = await repo.getSettings("alice");
      expect(settings.excluded_pokemon_ids).toEqual([4, 7]);
    });

    it("空配列で更新すると「除外なし」状態として保存される", async () => {
      const repo = createRepo();
      await repo.updateExcludedPokemon("alice", [1, 25]);
      await repo.updateExcludedPokemon("alice", []);

      const settings = await repo.getSettings("alice");
      expect(settings.excluded_pokemon_ids).toEqual([]);
    });

    it("あるユーザーの更新は別ユーザーの設定に影響しない", async () => {
      const repo = createRepo();
      await repo.updateExcludedPokemon("alice", [1, 25]);

      const bobSettings = await repo.getSettings("bob");
      expect(bobSettings.excluded_pokemon_ids).toBeNull();
    });
  });
}

userSettingsContract("MockUserSettingsRepo", () => new MockUserSettingsRepo());

const db = requireFirestoreEmulator();
userSettingsContract(
  "UserSettingsRepo (Firestore emulator)",
  () => new UserSettingsRepo(db),
  clearFirestoreEmulator,
);
