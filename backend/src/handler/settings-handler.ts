import type { Request, Response } from "express";
import type { PokemonFetcher, UserSettingsRepository } from "../domain/interfaces.js";
import { handleError } from "./error.js";

/**
 * ユーザが除外指定できるポケモン数の上限。
 * Why: quest-service の出題抽選は除外比率が上がるとリトライ失敗の確率が上がる。
 * maxPokemonID=898 想定でこの値以下なら 10 回リトライで実質衝突しない (確率 < 1e-14)。
 */
export const MAX_EXCLUDED_POKEMON_COUNT = 30;

/** ユーザ設定 (除外ポケモン等) のエンドポイントを束ねるハンドラ。 */
export class SettingsHandler {
  constructor(
    private settingsRepo: UserSettingsRepository,
    private pokemonFetcher: PokemonFetcher,
  ) {}

  /** GET /settings — 除外ポケモンIDと最大ポケモンIDを返す。 */
  getSettings = async (req: Request, res: Response) => {
    const uid = res.locals.uid as string;
    try {
      const settings = await this.settingsRepo.getSettings(uid);
      const excluded = settings.excluded_pokemon_ids ?? this.pokemonFetcher.getDefaultExcludedPokemonIDs();
      res.json({
        excluded_pokemon_ids: excluded,
        max_pokemon_id: this.pokemonFetcher.getMaxPokemonID(),
        max_excluded_count: MAX_EXCLUDED_POKEMON_COUNT,
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
    if (pokemon_ids.length > MAX_EXCLUDED_POKEMON_COUNT) {
      res.status(400).json({ error: `excluded_pokemon_ids exceeds limit (max ${MAX_EXCLUDED_POKEMON_COUNT})` });
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
