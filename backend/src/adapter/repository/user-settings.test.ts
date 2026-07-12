import { describe, it, expect, beforeEach } from "vitest";
import { UserSettingsRepo } from "./user-settings-repo.js";
import { requireFirestoreEmulator, clearFirestoreEmulator } from "./firestore-emulator-helper.js";

const db = requireFirestoreEmulator();

describe("ユーザー設定の保存", () => {
  beforeEach(clearFirestoreEmulator);

  it("一度も保存していないユーザーの設定を取得すると、苦手ポケモンは未設定が返る", async () => {
    const repo = new UserSettingsRepo(db);
    const settings = await repo.getSettings("newcomer");
    expect(settings.excluded_pokemon_ids).toBeNull();
  });

  it("保存した苦手ポケモンの一覧を読み直すと、同じ内容が返る", async () => {
    const repo = new UserSettingsRepo(db);
    await repo.updateExcludedPokemon("alice", [1, 25, 150]);

    const settings = await repo.getSettings("alice");
    expect(settings.excluded_pokemon_ids).toEqual([1, 25, 150]);
  });

  it("苦手ポケモンを再度保存すると、後の値で上書きされる", async () => {
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

  it("一度も保存していないユーザーの設定を取得すると、出題世代は未設定が返る", async () => {
    const repo = new UserSettingsRepo(db);
    const settings = await repo.getSettings("newcomer");
    expect(settings.enabled_generations).toBeNull();
  });

  it("保存した出題世代を読み直すと、同じ内容が返る", async () => {
    const repo = new UserSettingsRepo(db);
    await repo.updateEnabledGenerations("alice", [1, 3, 5]);

    const settings = await repo.getSettings("alice");
    expect(settings.enabled_generations).toEqual([1, 3, 5]);
  });
});
