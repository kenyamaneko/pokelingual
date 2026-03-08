import type { Request, Response } from "express";
import type { AIScorer, UserPokemonRepository } from "../domain/interfaces.js";
import type { QuestService, ChatRequest } from "../service/quest-service.js";
import { handleError } from "./error.js";

export class QuestHandler {
  private questService: QuestService;
  private repo: UserPokemonRepository;
  private aiScorer: AIScorer;

  constructor(questService: QuestService, repo: UserPokemonRepository, aiScorer: AIScorer) {
    this.questService = questService;
    this.repo = repo;
    this.aiScorer = aiScorer;
  }

  newQuest = async (req: Request, res: Response) => {
    const uid = res.locals.uid as string;
    try {
      const resp = await this.questService.newQuest(uid);
      res.json(resp);
    } catch (err) {
      handleError(res, err, req.path);
    }
  };

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

  attemptCapture = async (req: Request, res: Response) => {
    const uid = res.locals.uid as string;
    try {
      const resp = this.questService.attemptCapture(uid);
      try {
        await this.repo.upsertEncounter(uid, resp.pokemon_id, resp.score, resp.captured);
      } catch (err) {
        console.error("failed to persist encounter", { error: String(err), uid, pokemon_id: resp.pokemon_id });
      }
      res.json(resp);
    } catch (err) {
      handleError(res, err, req.path);
    }
  };

  chat = async (req: Request, res: Response) => {
    const body = req.body as ChatRequest;
    if (!body.messages || body.messages.length === 0) {
      res.status(400).json({ error: "messages are required" });
      return;
    }
    try {
      const reply = await this.aiScorer.chat(body.context, body.messages);
      res.json({ reply });
    } catch (err) {
      console.error("professor chat failed", { error: String(err) });
      res.status(502).json({ error: "AI service is temporarily unavailable" });
    }
  };
}
