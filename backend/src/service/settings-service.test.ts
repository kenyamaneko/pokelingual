import { describe, expect } from "vitest";
import { SettingsService } from "./settings-service.js";
import type { UserSettingsRepository } from "../domain/ports.js";
import type { UserSettings } from "../domain/user.js";
import { DEFAULT_MAX_EXCLUDED_POKEMON_COUNT } from "../testing/settings-fixture.js";
import { defineCase } from "../test/defineCase.js";

const SERVABLE_IDS = new Set([1, 4, 7, 25, 150]);

function makeService(initialSettings: UserSettings): SettingsService {
  let saved: UserSettings = initialSettings;
  const settingsRepo: UserSettingsRepository = {
    getSettings: async () => saved,
    updateExcludedPokemon: async (_userId, ids) => {
      saved = { ...saved, excluded_pokemon_ids: ids };
    },
    updateEnabledGenerations: async (_userId, generations) => {
      saved = { ...saved, enabled_generations: generations };
    },
  };
  return new SettingsService(settingsRepo, SERVABLE_IDS, DEFAULT_MAX_EXCLUDED_POKEMON_COUNT);
}

describe("[本体:設定]除外ポケモンの更新", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: "除外ポケモンに、図鑑番号の一覧ではなく文字列「not-an-array」が指定されたとき",
          When: ["除外ポケモンを更新する"],
          Then: "更新は失敗になり、理由は「excluded_pokemon_ids must be an array」(除外ポケモンの指定が図鑑番号の一覧でない) になる",
        },
      ],
    },
    async () => {
      const service = makeService({ excluded_pokemon_ids: [1, 4], enabled_generations: null });

      const result = await service.updateExcludedPokemon("alice", "not-an-array");
      expect(result).toEqual({ ok: false, message: "excluded_pokemon_ids must be an array" });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      steps: [
        {
          Given:
            "保存済みの除外ポケモンが図鑑番号 1 と 4 で、除外ポケモンに、図鑑番号の一覧ではなく文字列「not-an-array」が指定されたとき",
          When: ["除外ポケモンを更新する", "設定を取得する"],
          Then: "更新が失敗したあとの設定の除外ポケモンは、図鑑番号 1 と 4 のまま変わらない",
        },
      ],
    },
    async () => {
      const service = makeService({ excluded_pokemon_ids: [1, 4], enabled_generations: null });

      await service.updateExcludedPokemon("alice", "not-an-array");

      const settings = await service.getSettings("alice");
      expect(settings.excluded_pokemon_ids).toEqual([1, 4]);
    },
  );
});

describe("[本体:設定]出題世代の更新", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: "出題世代が 1 つも選ばれていない (空の一覧) とき",
          When: ["出題世代を更新する"],
          Then: "更新は失敗になり、理由は「at least one generation must be selected」(出題世代を 1 つ以上選ぶ必要がある) になる",
        },
      ],
    },
    async () => {
      const service = makeService({ excluded_pokemon_ids: null, enabled_generations: [1, 4] });

      const result = await service.updateEnabledGenerations("alice", []);
      expect(result).toEqual({ ok: false, message: "at least one generation must be selected" });
    },
  );

  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      steps: [
        {
          Given: "保存済みの出題世代が第 1 世代と第 4 世代で、出題世代が 1 つも選ばれていない (空の一覧) とき",
          When: ["出題世代を更新する", "設定を取得する"],
          Then: "更新が失敗したあとの設定の出題世代は、第 1 世代と第 4 世代のまま変わらない",
        },
      ],
    },
    async () => {
      const service = makeService({ excluded_pokemon_ids: null, enabled_generations: [1, 4] });

      await service.updateEnabledGenerations("alice", []);

      const settings = await service.getSettings("alice");
      expect(settings.enabled_generations).toEqual([1, 4]);
    },
  );
});
