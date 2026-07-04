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
};
