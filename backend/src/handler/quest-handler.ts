import type { Request, Response } from "express";
import type { AIScorer, UserPokemonRepository } from "../domain/interfaces.js";
import type { QuestService, ChatRequest } from "../service/quest-service.js";
import { ExternalServiceError } from "../apperror/apperror.js";
import { handleError } from "./error.js";

/** クエスト関連エンドポイント (出題・採点・名前推測・捕獲・チャット) を束ねるハンドラ。 */
export class QuestHandler {
  private questService: QuestService;
  private repo: UserPokemonRepository;
  private aiScorer: AIScorer;

  constructor(questService: QuestService, repo: UserPokemonRepository, aiScorer: AIScorer) {
    this.questService = questService;
    this.repo = repo;
    this.aiScorer = aiScorer;
  }

  /** GET /quest/new — 新しい出題ポケモンを返す。 */
  newQuest = async (req: Request, res: Response) => {
    const uid = res.locals.uid as string;
    try {
      const resp = await this.questService.newQuest(uid);
      res.json(resp);
    } catch (err) {
      handleError(res, err, req.path);
    }
  };

  /** POST /quest/score — ユーザの翻訳文を Gemini で採点しスコアを返す。 */
  scoreTranslation = async (req: Request, res: Response) => {
    const uid = res.locals.uid as string;
    const { translation } = req.body;
    if (!translation) {
      res.status(400).json({ error: "translation is required" });
      return;
    }
    try {
      const resp = await this.questService.scoreTranslation(uid, translation);
      res.json(resp);
    } catch (err) {
      handleError(res, err, req.path);
    }
  };

  /** POST /quest/guess-name — ポケモン名の推測を判定し残り試行回数を返す。 */
  guessName = (req: Request, res: Response) => {
    const uid = res.locals.uid as string;
    const { guess } = req.body;
    if (!guess) {
      res.status(400).json({ error: "guess is required" });
      return;
    }
    try {
      const resp = this.questService.guessName(uid, guess);
      res.json(resp);
    } catch (err) {
      handleError(res, err, req.path);
    }
  };

  /** POST /quest/capture — 捕獲を試行し結果を永続化する。 */
  attemptCapture = async (req: Request, res: Response) => {
    const uid = res.locals.uid as string;
    try {
      const resp = this.questService.attemptCapture(uid);
      try {
        await this.repo.upsertEncounter(uid, resp.pokemon_id, resp.score, resp.captured);
      } catch (err) {
        throw new ExternalServiceError("Firestore", err as Error);
      }
      res.json(resp);
    } catch (err) {
      handleError(res, err, req.path);
    }
  };

  /** POST /quest/chat — オーキド博士キャラクタとのチャット応答を返す。 */
  replyToChat = async (req: Request, res: Response) => {
    const body = req.body as ChatRequest;
    if (!body.messages || body.messages.length === 0) {
      res.status(400).json({ error: "messages are required" });
      return;
    }
    try {
      const reply = await this.aiScorer.replyToChat(body.context, body.messages);
      res.json({ reply });
    } catch (err) {
      handleError(res, new ExternalServiceError("Gemini", err as Error), req.path);
    }
  };
}
