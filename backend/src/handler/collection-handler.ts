import type { Request, Response } from "express";
import type { PokemonConfig, UserSettingsRepository } from "../domain/ports.js";
import type { CollectionService } from "../service/collection-service.js";
import type { CollectionResponse } from "../../../shared/api-types/collection.js";
import { handleError } from "./error.js";

/** ポケモン図鑑 (コレクション) 取得用エンドポイントを束ねるハンドラ。 */
export class CollectionHandler {
  /**
   * @param collectionService 図鑑取得のドメインサービス。
   * @param settingsRepo ユーザ設定リポジトリ。
   * @param pokemonConfig ポケモン関連のアプリ設定。
   */
  constructor(
    private collectionService: CollectionService,
    private settingsRepo: UserSettingsRepository,
    private pokemonConfig: PokemonConfig,
  ) {}

  /**
   * GET /collection — ユーザの図鑑一覧を返す。
   * @param req Express リクエスト。
   * @param res Express レスポンス。
   */
  getCollection = async (req: Request, res: Response) => {
    const uid = res.locals.uid as string;
    try {
      const { entries, unavailable_count } = await this.collectionService.getCollection(uid);
      const capturedCount = entries.filter((e) => e.status === "captured").length;
      const body: CollectionResponse = {
        pokemon: entries,
        total_available: this.pokemonConfig.maxPokemonID,
        captured_count: capturedCount,
        unavailable_count,
      };
      res.json(body);
    } catch (err) {
      handleError(res, err, req.path);
    }
  };

  /**
   * GET /collection/:id — 特定ポケモンの詳細を返す。
   * @param req Express リクエスト。
   * @param res Express レスポンス。
   */
  getPokemonDetail = async (req: Request, res: Response) => {
    const uid = res.locals.uid as string;
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "invalid pokemon id" });
      return;
    }
    try {
      const detail = await this.collectionService.getPokemonDetail(uid, id);
      res.json(detail);
    } catch (err) {
      handleError(res, err, req.path);
    }
  };
}
