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

const GET_SETTINGS = "あるユーザーの設定を取得する";
const UPDATE_EXCLUDED_POKEMON_WITH_STRING = "全国図鑑番号の一覧でなく文字列を指定して、除外ポケモンを更新する";
const UPDATE_GENERATIONS_WITHOUT_GENERATION = "世代を 1 つも指定せずに、出題世代を更新する";

describe("[共通:設定]除外ポケモンの更新", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      観点: ["エッジケース"],
      steps: [
        {
          When: [UPDATE_EXCLUDED_POKEMON_WITH_STRING],
          Then: "除外する全国図鑑番号は一覧で指定する必要があることを示すエラーになる",
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
          Given: "保存済みの除外ポケモンが全国図鑑番号 1 と 4 のとき",
          When: [UPDATE_EXCLUDED_POKEMON_WITH_STRING, GET_SETTINGS],
          Then: "更新が失敗したあとの設定の除外ポケモンは、全国図鑑番号 1 と 4 のまま変わらない",
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

describe("[共通:設定]出題世代の更新", () => {
  defineCase(
    {
      種別: "単体テスト",
      正常異常: "異常系",
      観点: ["件数・有無"],
      steps: [
        {
          When: [UPDATE_GENERATIONS_WITHOUT_GENERATION],
          Then: "1 つ以上の世代の選択が必要なことを示すエラーになる",
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
          Given: "保存済みの出題世代が第 1 世代と第 4 世代のとき",
          When: [UPDATE_GENERATIONS_WITHOUT_GENERATION, GET_SETTINGS],
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
