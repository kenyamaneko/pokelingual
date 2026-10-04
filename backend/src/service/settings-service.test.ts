import { describe, it, expect } from "vitest";
import { SettingsService } from "./settings-service.js";
import type { UserSettingsRepository } from "../domain/ports.js";
import type { UserSettings } from "../domain/user.js";
import { DEFAULT_MAX_EXCLUDED_POKEMON_COUNT } from "../testing/settings-fixture.js";

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

describe("[設定] 除外ポケモンの更新", () => {
  describe("異常系", () => {
    describe("除外ポケモンに図鑑番号の一覧ではなく文字列が指定されたとき", () => {
      it("更新結果は失敗になり、理由は除外ポケモンの指定が図鑑番号の一覧でないことになる", async () => {
        const service = makeService({ excluded_pokemon_ids: [1, 4], enabled_generations: null });

        const result = await service.updateExcludedPokemon("alice", "not-an-array");
        expect(result).toEqual({ ok: false, message: "excluded_pokemon_ids must be an array" });
      });

      it("保存済みの除外ポケモンが図鑑番号 1 と 4 のとき、設定を読み直した除外ポケモンは図鑑番号 1 と 4 のまま変わらない", async () => {
        const service = makeService({ excluded_pokemon_ids: [1, 4], enabled_generations: null });

        await service.updateExcludedPokemon("alice", "not-an-array");

        const settings = await service.getSettings("alice");
        expect(settings.excluded_pokemon_ids).toEqual([1, 4]);
      });
    });
  });
});

describe("[設定] 出題世代の更新", () => {
  describe("異常系", () => {
    describe("出題世代が 1 つも選ばれていない (空の一覧) とき", () => {
      it("更新結果は失敗になり、理由は出題世代を 1 つ以上選ぶ必要があることになる", async () => {
        const service = makeService({ excluded_pokemon_ids: null, enabled_generations: [1, 4] });

        const result = await service.updateEnabledGenerations("alice", []);
        expect(result).toEqual({ ok: false, message: "at least one generation must be selected" });
      });

      it("保存済みの出題世代が第 1 世代と第 4 世代のとき、設定を読み直した出題世代は第 1 世代と第 4 世代のまま変わらない", async () => {
        const service = makeService({ excluded_pokemon_ids: null, enabled_generations: [1, 4] });

        await service.updateEnabledGenerations("alice", []);

        const settings = await service.getSettings("alice");
        expect(settings.enabled_generations).toEqual([1, 4]);
      });
    });
  });
});
