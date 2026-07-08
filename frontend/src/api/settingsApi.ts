import api from "./client";
import type { SettingsResponse } from "../../../shared/api-types/settings";

/** ユーザ設定エンドポイントを呼ぶ API クライアント。 */
export const settingsApi = {
  /**
   * GET /settings — ユーザ設定を取得する。
   * @returns 設定レスポンス。
   */
  getSettings: () => api.get<SettingsResponse>("/settings"),
  /**
   * PUT /settings/excluded-pokemon — 除外ポケモンを更新する。
   * @param pokemonIDs 除外するポケモン ID の配列。
   * @returns 更新結果のレスポンス。
   */
  updateExcludedPokemon: (pokemonIDs: number[]) =>
    api.put("/settings/excluded-pokemon", { pokemon_ids: pokemonIDs }),
  /**
   * PUT /settings/generations — 出題対象の世代を更新する。
   * @param generations 出題対象の世代番号の配列 (最低1世代)。
   * @returns 更新結果のレスポンス。
   */
  updateEnabledGenerations: (generations: number[]) =>
    api.put("/settings/generations", { generations }),
};
