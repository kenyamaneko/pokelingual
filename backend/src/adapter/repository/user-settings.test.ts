import { describe, it, expect, beforeEach } from "vitest";
import { UserSettingsRepo } from "./user-settings-repo.js";
import { requireFirestoreEmulator, clearFirestoreEmulator } from "./firestore-emulator-helper.js";

const db = requireFirestoreEmulator();

describe("[設定] 苦手ポケモンの保存", () => {
  beforeEach(clearFirestoreEmulator);

  describe("設定を取得する", () => {
    describe("正常系", () => {
      it.each([
        ["一度も保存していない", []],
        ["別のユーザーだけが苦手ポケモンを保存している", [[1, 25]]],
      ])("%sとき、苦手ポケモンは未設定になる", async (_label, otherUserExcludedIDLists) => {
        const repo = new UserSettingsRepo(db);
        for (const excludedIDs of otherUserExcludedIDLists) {
          await repo.updateExcludedPokemon("bob", excludedIDs);
        }

        const settings = await repo.getSettings("alice");
        expect(settings.excluded_pokemon_ids).toBeNull();
      });

      it("苦手ポケモンとして図鑑番号 1、25、150 を保存したとき、苦手ポケモンは図鑑番号 1、25、150 になる", async () => {
        const repo = new UserSettingsRepo(db);
        await repo.updateExcludedPokemon("alice", [1, 25, 150]);

        const settings = await repo.getSettings("alice");
        expect(settings.excluded_pokemon_ids).toEqual([1, 25, 150]);
      });

      it("苦手ポケモンとして図鑑番号 1、25 を保存した後に図鑑番号 4、7 で保存し直したとき、苦手ポケモンは図鑑番号 4、7 になる", async () => {
        const repo = new UserSettingsRepo(db);
        await repo.updateExcludedPokemon("alice", [1, 25]);
        await repo.updateExcludedPokemon("alice", [4, 7]);

        const settings = await repo.getSettings("alice");
        expect(settings.excluded_pokemon_ids).toEqual([4, 7]);
      });

      it("苦手ポケモンとして図鑑番号 1、25 を保存した後に 1 件も無い状態で保存し直したとき、苦手ポケモンは未設定ではなく 1 件も無い状態になる", async () => {
        const repo = new UserSettingsRepo(db);
        await repo.updateExcludedPokemon("alice", [1, 25]);
        await repo.updateExcludedPokemon("alice", []);

        const settings = await repo.getSettings("alice");
        expect(settings.excluded_pokemon_ids).toEqual([]);
      });
    });
  });
});

describe("[設定] 出題世代の保存", () => {
  beforeEach(clearFirestoreEmulator);

  describe("設定を取得する", () => {
    describe("正常系", () => {
      it("一度も保存していないとき、出題世代は未設定になる", async () => {
        const repo = new UserSettingsRepo(db);
        const settings = await repo.getSettings("newcomer");
        expect(settings.enabled_generations).toBeNull();
      });

      it("出題世代として 1、3、5 を保存したとき、出題世代は 1、3、5 になる", async () => {
        const repo = new UserSettingsRepo(db);
        await repo.updateEnabledGenerations("alice", [1, 3, 5]);

        const settings = await repo.getSettings("alice");
        expect(settings.enabled_generations).toEqual([1, 3, 5]);
      });
    });
  });
});
