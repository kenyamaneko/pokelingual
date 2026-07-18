import type { Request, Response } from "express";
import type { SettingsService } from "../service/settings-service.js";
import type {
  UpdateExcludedPokemonRequest,
  UpdateEnabledGenerationsRequest,
} from "../../../shared/api-types/settings.js";
import type { ErrorResponse } from "../../../shared/api-types/error.js";
import { handleError } from "./error.js";

/** ユーザ設定 (除外ポケモン等) のエンドポイントを束ねるハンドラ。 */
export class SettingsHandler {
  /**
   * @param settingsService ユーザ設定のドメインサービス。
   */
  constructor(private settingsService: SettingsService) {}

  /**
   * GET /settings — ユーザ自身の除外ポケモンIDを返す。
   * @param req Express リクエスト。
   * @param res Express レスポンス。
   */
  getSettings = async (req: Request, res: Response) => {
    const userId = res.locals.userId as string;
    try {
      const body = await this.settingsService.getSettings(userId);
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
    const body = req.body as Partial<UpdateExcludedPokemonRequest>;
    try {
      const result = await this.settingsService.updateExcludedPokemon(userId, body.pokemon_ids);
      if (!result.ok) {
        res.status(400).json({ error: result.message } satisfies ErrorResponse);
        return;
      }
      res.json({ status: "ok" });
    } catch (err) {
      handleError(res, err, req.path);
    }
  };

  /**
   * PUT /settings/generations — 出題対象の世代リストをバリデーションして更新する。
   * @param req Express リクエスト。
   * @param res Express レスポンス。
   */
  updateEnabledGenerations = async (req: Request, res: Response) => {
    const userId = res.locals.userId as string;
    const body = req.body as Partial<UpdateEnabledGenerationsRequest>;
    try {
      const result = await this.settingsService.updateEnabledGenerations(userId, body.generations);
      if (!result.ok) {
        res.status(400).json({ error: result.message } satisfies ErrorResponse);
        return;
      }
      res.json({ status: "ok" });
    } catch (err) {
      handleError(res, err, req.path);
    }
  };
}
