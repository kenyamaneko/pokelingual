import { describe, expect, beforeEach } from "vitest";
import { UserSettingsRepo } from "./user-settings-repo.js";
import { requireFirestoreEmulator, clearFirestoreEmulator } from "./firestore-emulator-helper.js";
import { defineCase } from "../../test/defineCase.js";

const db = requireFirestoreEmulator();

const GET_SETTINGS = "あるユーザーの設定を取得する";

describe("[共通:設定]除外ポケモンの保存", () => {
  beforeEach(clearFirestoreEmulator);

  for (const { situation, otherUserExcludedIDLists } of [
    { situation: "除外ポケモンを一度も保存していないとき", otherUserExcludedIDLists: [] },
    {
      situation: "別のユーザーだけが除外ポケモンとして図鑑番号 1、25 を保存しているとき",
      otherUserExcludedIDLists: [[1, 25]],
    },
  ]) {
    defineCase(
      {
        種別: "インフラ結合テスト",
        正常異常: "正常系",
        steps: [{ Given: situation, When: [GET_SETTINGS], Then: "除外ポケモンは未設定になる" }],
      },
      async () => {
        const repo = new UserSettingsRepo(db);
        for (const excludedIDs of otherUserExcludedIDLists) {
          await repo.updateExcludedPokemon("bob", excludedIDs);
        }

        const settings = await repo.getSettings("alice");
        expect(settings.excluded_pokemon_ids).toBeNull();
      },
    );
  }

  defineCase(
    {
      種別: "インフラ結合テスト",
      正常異常: "正常系",
      steps: [
        {
          When: ["あるユーザーの除外ポケモンとして、図鑑番号 1、25、150 を保存する", GET_SETTINGS],
          Then: "除外ポケモンは図鑑番号 1、25、150 になる",
        },
      ],
    },
    async () => {
      const repo = new UserSettingsRepo(db);
      await repo.updateExcludedPokemon("alice", [1, 25, 150]);

      const settings = await repo.getSettings("alice");
      expect(settings.excluded_pokemon_ids).toEqual([1, 25, 150]);
    },
  );

  defineCase(
    {
      種別: "インフラ結合テスト",
      正常異常: "正常系",
      steps: [
        {
          When: [
            "あるユーザーの除外ポケモンとして、図鑑番号 1、25 を保存する",
            "あるユーザーの除外ポケモンとして、図鑑番号 4、7 を保存する",
            GET_SETTINGS,
          ],
          Then: "除外ポケモンは図鑑番号 4、7 になる",
        },
      ],
    },
    async () => {
      const repo = new UserSettingsRepo(db);
      await repo.updateExcludedPokemon("alice", [1, 25]);
      await repo.updateExcludedPokemon("alice", [4, 7]);

      const settings = await repo.getSettings("alice");
      expect(settings.excluded_pokemon_ids).toEqual([4, 7]);
    },
  );

  defineCase(
    {
      種別: "インフラ結合テスト",
      正常異常: "正常系",
      steps: [
        {
          When: [
            "あるユーザーの除外ポケモンとして、図鑑番号 1、25 を保存する",
            "あるユーザーの除外ポケモンとして、図鑑番号を 1 件も指定せずに保存する",
            GET_SETTINGS,
          ],
          Then: "除外ポケモンは未設定ではなく 1 件も無い状態になる",
        },
      ],
    },
    async () => {
      const repo = new UserSettingsRepo(db);
      await repo.updateExcludedPokemon("alice", [1, 25]);
      await repo.updateExcludedPokemon("alice", []);

      const settings = await repo.getSettings("alice");
      expect(settings.excluded_pokemon_ids).toEqual([]);
    },
  );
});

describe("[共通:設定]出題世代の保存", () => {
  beforeEach(clearFirestoreEmulator);

  defineCase(
    {
      種別: "インフラ結合テスト",
      正常異常: "正常系",
      steps: [
        {
          Given: "出題世代を一度も保存していないとき",
          When: [GET_SETTINGS],
          Then: "出題世代は未設定になる",
        },
      ],
    },
    async () => {
      const repo = new UserSettingsRepo(db);
      const settings = await repo.getSettings("newcomer");
      expect(settings.enabled_generations).toBeNull();
    },
  );

  defineCase(
    {
      種別: "インフラ結合テスト",
      正常異常: "正常系",
      steps: [
        {
          When: ["あるユーザーの出題世代として、1、3、5 を保存する", GET_SETTINGS],
          Then: "出題世代は 1、3、5 になる",
        },
      ],
    },
    async () => {
      const repo = new UserSettingsRepo(db);
      await repo.updateEnabledGenerations("alice", [1, 3, 5]);

      const settings = await repo.getSettings("alice");
      expect(settings.enabled_generations).toEqual([1, 3, 5]);
    },
  );
});
