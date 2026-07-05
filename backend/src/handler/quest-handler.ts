import type { Request, Response } from "express";
import type { UserPokemonRepository } from "../domain/ports.js";
import type { QuestService } from "../service/quest-service.js";
import type { ErrorResponse } from "../../../shared/api-types/error.js";
import { ExternalServiceError } from "../domain/errors.js";
import { handleError } from "./error.js";

/** クエスト関連エンドポイント (出題・採点・名前推測・捕獲) を束ねるハンドラ。 */
export class QuestHandler {
  /**
   * @param questService クエストのドメインサービス。
   * @param repo ユーザの図鑑進捗リポジトリ。
   */
  constructor(
    private questService: QuestService,
    private repo: UserPokemonRepository,
  ) {}

  /**
   * GET /quest/new — 新しい出題ポケモンを返す。
   * @param req Express リクエスト。
   * @param res Express レスポンス。
   */
  newQuest = async (req: Request, res: Response) => {
    const userId = res.locals.userId as string;
    try {
      const resp = await this.questService.newQuest(userId);
      res.json(resp);
    } catch (err) {
      handleError(res, err, req.path);
    }
  };

  /**
   * POST /quest/score — ユーザの翻訳文を LLM で採点しスコアを返す。
   * @param req Express リクエスト。
   * @param res Express レスポンス。
   */
  scoreTranslation = async (req: Request, res: Response) => {
    const userId = res.locals.userId as string;
    const { translation } = req.body;
    if (!translation) {
      res.status(400).json({ error: "translation is required" } satisfies ErrorResponse);
      return;
    }
    try {
      const resp = await this.questService.scoreTranslation(userId, translation);
      res.json(resp);
    } catch (err) {
      handleError(res, err, req.path);
    }
  };

  /**
   * POST /quest/guess-name — ポケモン名の推測を判定し残り試行回数を返す。
   * @param req Express リクエスト。
   * @param res Express レスポンス。
   */
  guessName = (req: Request, res: Response) => {
    const userId = res.locals.userId as string;
    const { guess } = req.body;
    if (!guess) {
      res.status(400).json({ error: "guess is required" } satisfies ErrorResponse);
      return;
    }
    try {
      const resp = this.questService.guessName(userId, guess);
      res.json(resp);
    } catch (err) {
      handleError(res, err, req.path);
    }
  };

  /**
   * POST /quest/skip-guess — 名前当てをスキップして、ボールを確定する。
   * @param req Express リクエスト。
   * @param res Express レスポンス。
   */
  skipGuess = (req: Request, res: Response) => {
    const userId = res.locals.userId as string;
    try {
      const resp = this.questService.skipGuess(userId);
      res.json(resp);
    } catch (err) {
      handleError(res, err, req.path);
    }
  };

  /**
   * POST /quest/capture — 捕獲を試行し結果を永続化する。
   * @param req Express リクエスト。
   * @param res Express レスポンス。
   */
  attemptCapture = async (req: Request, res: Response) => {
    const userId = res.locals.userId as string;
    try {
      const resp = this.questService.attemptCapture(userId);
      try {
        await this.repo.upsertEncounter(userId, resp.pokemon_id, resp.score, resp.captured);
      } catch (err) {
        throw new ExternalServiceError("Firestore", err as Error);
      }
      res.json(resp);
    } catch (err) {
      handleError(res, err, req.path);
    }
  };
}
