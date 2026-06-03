import type { Request, Response } from "express";
import type { PokemonConfig, UserSettingsRepository } from "../domain/ports.js";
import type { CollectionService } from "../service/collection-service.js";
import type { CollectionResponse } from "../../../shared/api-types/collection.js";
import { handleError } from "./error.js";

/** ポケモン図鑑 (コレクション) 取得用エンドポイントを束ねるハンドラ。 */
export class CollectionHandler {
  constructor(
    private collectionService: CollectionService,
    private settingsRepo: UserSettingsRepository,
    private pokemonConfig: PokemonConfig,
  ) {}

  /** GET /collection — ユーザの図鑑一覧を返す。 */
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

  /** GET /collection/:id — 特定ポケモンの詳細を返す。 */
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
