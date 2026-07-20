import type { Request, Response } from "express";
import type { PokedexService } from "../service/pokedex-service.js";
import type { PokedexResponse, PokedexSearchCandidatesResponse } from "../../../shared/api-types/pokedex.js";
import type { ErrorResponse } from "../../../shared/api-types/error.js";
import { handleError } from "./error.js";

/** ポケモン図鑑 (pokedex) 取得用エンドポイントを束ねるハンドラ。 */
export class PokedexHandler {
  /**
   * @param pokedexService 図鑑取得のドメインサービス。
   */
  constructor(private pokedexService: PokedexService) {}

  /**
   * GET /pokedex — ユーザの図鑑一覧を返す。
   * @param req Express リクエスト。
   * @param res Express レスポンス。
   */
  getPokedex = async (req: Request, res: Response) => {
    const userId = res.locals.userId as string;
    try {
      const { entries, unavailable_count } = await this.pokedexService.getPokedex(userId);
      const capturedCount = entries.filter((e) => e.status === "captured").length;
      const body: PokedexResponse = {
        pokemon: entries,
        captured_count: capturedCount,
        unavailable_count,
      };
      res.json(body);
    } catch (err) {
      handleError(res, err, req.path);
    }
  };

  /**
   * GET /pokedex/search-candidates — 苦手ポケモン名前検索の候補母集団を返す。
   * @param req Express リクエスト。
   * @param res Express レスポンス。
   */
  getSearchCandidates = async (req: Request, res: Response) => {
    try {
      const pokemon = await this.pokedexService.getSearchCandidates();
      const body: PokedexSearchCandidatesResponse = { pokemon };
      res.json(body);
    } catch (err) {
      handleError(res, err, req.path);
    }
  };

  /**
   * GET /pokedex/:id — 特定ポケモンの詳細を返す。
   * @param req Express リクエスト。
   * @param res Express レスポンス。
   */
  getPokemonDetail = async (req: Request, res: Response) => {
    const userId = res.locals.userId as string;
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "invalid pokemon id" } satisfies ErrorResponse);
      return;
    }
    try {
      const detail = await this.pokedexService.getPokemonDetail(userId, id);
      res.json(detail);
    } catch (err) {
      handleError(res, err, req.path);
    }
  };
}
