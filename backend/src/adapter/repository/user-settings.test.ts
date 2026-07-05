import { describe, it, expect, beforeEach } from "vitest";
import { UserSettingsRepo } from "./user-settings-repo.js";
import { requireFirestoreEmulator, clearFirestoreEmulator } from "./firestore-emulator-helper.js";

const db = requireFirestoreEmulator();

describe("UserSettingsRepo (Firestore emulator)", () => {
  beforeEach(clearFirestoreEmulator);

  it("未保存ユーザーは excluded_pokemon_ids=null として読める", async () => {
    const repo = new UserSettingsRepo(db);
    const settings = await repo.getSettings("newcomer");
    expect(settings.excluded_pokemon_ids).toBeNull();
  });

  it("updateExcludedPokemon で保存した値が getSettings で取得できる", async () => {
    const repo = new UserSettingsRepo(db);
    await repo.updateExcludedPokemon("alice", [1, 25, 150]);

    const settings = await repo.getSettings("alice");
    expect(settings.excluded_pokemon_ids).toEqual([1, 25, 150]);
  });

  it("updateExcludedPokemon は後勝ちで上書きする", async () => {
    const repo = new UserSettingsRepo(db);
    await repo.updateExcludedPokemon("alice", [1, 25]);
    await repo.updateExcludedPokemon("alice", [4, 7]);

    const settings = await repo.getSettings("alice");
    expect(settings.excluded_pokemon_ids).toEqual([4, 7]);
  });

  it("空配列で更新すると「除外なし」状態として保存される", async () => {
    const repo = new UserSettingsRepo(db);
    await repo.updateExcludedPokemon("alice", [1, 25]);
    await repo.updateExcludedPokemon("alice", []);

    const settings = await repo.getSettings("alice");
    expect(settings.excluded_pokemon_ids).toEqual([]);
  });

  it("あるユーザーの更新は別ユーザーの設定に影響しない", async () => {
    const repo = new UserSettingsRepo(db);
    await repo.updateExcludedPokemon("alice", [1, 25]);

    const bobSettings = await repo.getSettings("bob");
    expect(bobSettings.excluded_pokemon_ids).toBeNull();
  });

  it("未保存ユーザーは enabled_generations=null として読める", async () => {
    const repo = new UserSettingsRepo(db);
    const settings = await repo.getSettings("newcomer");
    expect(settings.enabled_generations).toBeNull();
  });

  it("updateEnabledGenerations で保存した値が getSettings で取得できる", async () => {
    const repo = new UserSettingsRepo(db);
    await repo.updateEnabledGenerations("alice", [1, 3, 5]);

    const settings = await repo.getSettings("alice");
    expect(settings.enabled_generations).toEqual([1, 3, 5]);
  });

  it("世代の保存は除外ポケモンを消さない (フィールドは独立に保持される)", async () => {
    const repo = new UserSettingsRepo(db);
    await repo.updateExcludedPokemon("alice", [1, 25]);
    await repo.updateEnabledGenerations("alice", [2]);

    const settings = await repo.getSettings("alice");
    expect(settings.excluded_pokemon_ids).toEqual([1, 25]);
    expect(settings.enabled_generations).toEqual([2]);
  });
});
