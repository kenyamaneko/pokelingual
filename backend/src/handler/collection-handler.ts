import type { Request, Response } from "express";
import type { UserSettingsRepository } from "../domain/interfaces.js";
import type { CollectionService } from "../service/collection-service.js";
import { maxPokemonID } from "../service/pokeapi-service.js";
import { handleError } from "./error.js";

export class CollectionHandler {
  private collectionService: CollectionService;
  private settingsRepo: UserSettingsRepository;

  constructor(collectionService: CollectionService, settingsRepo: UserSettingsRepository) {
    this.collectionService = collectionService;
    this.settingsRepo = settingsRepo;
  }

  getCollection = async (req: Request, res: Response) => {
    const uid = res.locals.uid as string;
    try {
      const entries = await this.collectionService.getCollection(uid);
      const capturedCount = entries.filter((e) => e.status === "captured").length;
      res.json({
        pokemon: entries,
        total_available: maxPokemonID,
        captured_count: capturedCount,
      });
    } catch (err) {
      handleError(res, err, req.path);
    }
  };

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
