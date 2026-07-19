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
  it("配列でない入力のとき、更新は失敗し、既存の除外設定がそのまま残る", async () => {
    const service = makeService({ excluded_pokemon_ids: [1, 4], enabled_generations: null });

    const result = await service.updateExcludedPokemon("alice", "not-an-array");
    expect(result.ok).toBe(false);

    const settings = await service.getSettings("alice");
    expect(settings.excluded_pokemon_ids).toEqual([1, 4]);
  });
});

describe("[設定] 出題世代の更新", () => {
  it("空配列のとき、更新は失敗し、既存の世代設定がそのまま残る", async () => {
    const service = makeService({ excluded_pokemon_ids: null, enabled_generations: [1, 4] });

    const result = await service.updateEnabledGenerations("alice", []);
    expect(result.ok).toBe(false);

    const settings = await service.getSettings("alice");
    expect(settings.enabled_generations).toEqual([1, 4]);
  });
});
