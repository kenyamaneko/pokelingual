import type { Request, Response } from "express";
import type { UserSettingsRepository } from "../domain/interfaces.js";
import { maxPokemonID, defaultExcludedPokemonIDs } from "../service/pokeapi-service.js";
import { handleError } from "./error.js";

/** ユーザ設定 (除外ポケモン等) のエンドポイントを束ねるハンドラ。 */
export class SettingsHandler {
  private settingsRepo: UserSettingsRepository;

  constructor(settingsRepo: UserSettingsRepository) {
    this.settingsRepo = settingsRepo;
  }

  /** GET /settings — 除外ポケモンIDと最大ポケモンIDを返す。 */
  getSettings = async (req: Request, res: Response) => {
    const uid = res.locals.uid as string;
    try {
      const settings = await this.settingsRepo.getSettings(uid);
      const excluded = settings.excluded_pokemon_ids ?? defaultExcludedPokemonIDs;
      res.json({
        excluded_pokemon_ids: excluded,
        max_pokemon_id: maxPokemonID,
      });
    } catch (err) {
      handleError(res, err, req.path);
    }
  };

  /** PUT /settings/excluded-pokemon — 除外ポケモンIDリストを更新する。 */
  updateExcludedPokemon = async (req: Request, res: Response) => {
    const uid = res.locals.uid as string;
    const { pokemon_ids } = req.body;
    if (!Array.isArray(pokemon_ids)) {
      res.status(400).json({ error: "invalid request body" });
      return;
    }
    try {
      await this.settingsRepo.updateExcludedPokemon(uid, pokemon_ids);
      res.json({ status: "ok" });
    } catch (err) {
      handleError(res, err, req.path);
    }
  };
}
