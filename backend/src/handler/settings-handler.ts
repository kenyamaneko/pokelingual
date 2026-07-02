import type { Request, Response } from "express";
import type { PokemonConfig, UserSettingsRepository } from "../domain/ports.js";
import type { SettingsResponse } from "../../../shared/api-types/settings.js";
import type { ErrorResponse } from "../../../shared/api-types/error.js";
import { validateExcludedPokemonIDs } from "../domain/settings.js";
import { handleError } from "./error.js";

/**
 * ユーザが除外指定できるポケモン数の上限。
 * Why: quest-service の出題抽選は除外比率が上がるとリトライ失敗の確率が上がる。
 * maxPokemonID=898 想定でこの値以下なら 10 回リトライで実質衝突しない (確率 < 1e-14)。
 */
export const MAX_EXCLUDED_POKEMON_COUNT = 30;

/** ユーザ設定 (除外ポケモン等) のエンドポイントを束ねるハンドラ。 */
export class SettingsHandler {
  /**
   * @param settingsRepo ユーザ設定リポジトリ。
   * @param pokemonConfig ポケモン関連のアプリ設定。
   */
  constructor(
    private settingsRepo: UserSettingsRepository,
    private pokemonConfig: PokemonConfig,
  ) {}

  /**
   * GET /settings — ユーザ自身の除外ポケモンIDを返す。
   * @param req Express リクエスト。
   * @param res Express レスポンス。
   */
  getSettings = async (req: Request, res: Response) => {
    const userId = res.locals.userId as string;
    try {
      const settings = await this.settingsRepo.getSettings(userId);
      // 設定画面はユーザー自身の除外だけを表示する (開発者除外はシステム側で透過的に適用)。
      const body: SettingsResponse = {
        excluded_pokemon_ids: settings.excluded_pokemon_ids ?? [],
      };
      res.json(body);
    } catch (err) {
      handleError(res, err, req.path);
    }
  };

  /**
   * PUT /settings/excluded-pokemon — 除外ポケモンIDリストをバリデーションして更新する。
   * @param req Express リクエスト。
   * @param res Express レスポンス。
   */
  updateExcludedPokemon = async (req: Request, res: Response) => {
    const userId = res.locals.userId as string;
    const result = validateExcludedPokemonIDs(
      req.body?.pokemon_ids,
      this.pokemonConfig.maxPokemonID,
      MAX_EXCLUDED_POKEMON_COUNT,
    );
    if (!result.ok) {
      res.status(400).json({ error: result.message } satisfies ErrorResponse);
      return;
    }
    try {
      await this.settingsRepo.updateExcludedPokemon(userId, result.ids);
      res.json({ status: "ok" });
    } catch (err) {
      handleError(res, err, req.path);
    }
  };
}
