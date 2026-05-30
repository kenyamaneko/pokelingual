import type { Request, Response } from "express";
import type { PokemonFetcher, UserSettingsRepository } from "../domain/interfaces.js";
import type { CollectionService } from "../service/collection-service.js";
import { handleError } from "./error.js";

/** ポケモン図鑑 (コレクション) 取得用エンドポイントを束ねるハンドラ。 */
export class CollectionHandler {
  constructor(
    private collectionService: CollectionService,
    private settingsRepo: UserSettingsRepository,
    private pokemonFetcher: PokemonFetcher,
  ) {}

  /** GET /collection — ユーザの図鑑一覧を返す。 */
  getCollection = async (req: Request, res: Response) => {
    const uid = res.locals.uid as string;
    try {
      const { entries, unavailable_count } = await this.collectionService.getCollection(uid);
      const capturedCount = entries.filter((e) => e.status === "captured").length;
      res.json({
        pokemon: entries,
        total_available: this.pokemonFetcher.getMaxPokemonID(),
        captured_count: capturedCount,
        unavailable_count,
      });
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
